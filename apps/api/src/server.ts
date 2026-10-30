import express from "express";
import cors from "cors";
import helmet from "helmet";
import { PrismaClient, HoldStatus, Role } from "@prisma/client";
import { z } from "zod";
const db=new PrismaClient(); const app=express(); app.use(helmet()); app.use(cors({origin:process.env.WEB_ORIGIN||"http://localhost:5174"})); app.use(express.json({limit:"1mb"}));
type Actor={id:string;role:Role;name:string};
declare global { namespace Express { interface Request { actor?:Actor } } }
app.use(async(req,res,next)=>{ if(process.env.DEV_AUTH!=="true") return res.status(501).json({error:"OIDC adapter must be configured"}); const user=await db.user.findFirst({where:{active:true}}); if(!user)return res.status(401).end(); req.actor={id:user.id,role:user.role,name:user.name}; next(); });
const allow=(...roles:Role[])=> (req:any,res:any,next:any)=>roles.includes(req.actor.role)?next():res.status(403).json({error:"Forbidden"});
const audit=(actorId:string,action:string,recordType:string,recordId:string,before?:any,after?:any)=>db.auditEvent.create({data:{actorId,action,recordType,recordId,before,after}});
app.get("/api/dashboard",async(_req,res)=>{const [active,verify,legal,its,overdue,alerts,recent]=await Promise.all([db.hold.count({where:{status:"ACTIVE"}}),db.hold.count({where:{status:"VERIFICATION_REQUIRED"}}),db.hold.count({where:{status:"LEGAL_REVIEW_REQUIRED"}}),db.hold.count({where:{status:"ITS_FOLLOW_UP_REQUIRED"}}),db.task.count({where:{dueDate:{lt:new Date()},status:{not:"COMPLETED"}}}),db.holdMatterLink.count({where:{decision:"PENDING"}}),db.hold.findMany({take:6,orderBy:{updatedAt:"desc"},include:{student:true,institution:true}})]);res.json({cards:{active,verify,legal,its,overdue,alerts},recent});});
const studentInput = z.object({
  legalName: z.string().min(2),
  preferredName: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  mailingAddress: z.string().optional(),

  institutionId: z.string().min(1),
  studentRef: z.string().optional(),
  program: z.string().optional(),
  enrollmentStatus: z.string().optional(),

  preferredContact: z.string().optional(),
  consentStatus: z.string().min(1),
  conflictStatus: z.string().min(1),
  notes: z.string().optional()
});

app.get("/api/students",async(_req,res)=>res.json(await db.student.findMany({include:{institution:true,_count:{select:{holds:true,matters:true}}},orderBy:{legalName:"asc"}})));

app.get("/api/students/:id", async (req, res) => {
  const student = await db.student.findUnique({
    where: {
      id: req.params.id
    },
    include: {
      institution: true,

      holds: {
        include: {
          institution: true
        },
        orderBy: {
          updatedAt: "desc"
        }
      },

      matters: {
        orderBy: {
          updatedAt: "desc"
        }
      },

      tasks: {
        orderBy: {
          dueDate: "asc"
        }
      },

      communications: {
        orderBy: {
          occurredAt: "desc"
        }
      }
    }
  });

  if (!student) {
    return res.status(404).json({
      error: "Student not found"
    });
  }

  res.json(student);
});

app.post(
  "/api/students",
  allow("ATTORNEY_ADMIN", "LEGAL_STAFF"),
  async (req, res) => {
    const data = studentInput.parse(req.body);

    const count = await db.student.count();

    const student = await db.student.create({
      data: {
        clientId: `STU-${String(count + 1).padStart(5, "0")}`,
        legalName: data.legalName,
        preferredName: data.preferredName || null,
        email: data.email || null,
        phone: data.phone || null,
        mailingAddress: data.mailingAddress || null,
        institutionId: data.institutionId,
        studentRef: data.studentRef || null,
        program: data.program || null,
        enrollmentStatus: data.enrollmentStatus || null,
        preferredContact: data.preferredContact || null,
        consentStatus: data.consentStatus,
        conflictStatus: data.conflictStatus,
        notes: data.notes || null,
        ownerId: req.actor!.id,
        status: "Active"
      },
      include: {
        institution: true
      }
    });

    await audit(
      req.actor!.id,
      "CREATE",
      "Student",
      student.id,
      undefined,
      {
        clientId: student.clientId,
        legalName: student.legalName
      }
    );

    res.status(201).json(student);
  }
);

app.get("/api/holds",async(req,res)=>res.json(await db.hold.findMany({where:req.query.status?{status:req.query.status as HoldStatus}:undefined,include:{student:true,institution:true,contact:true,statusHistory:{orderBy:{createdAt:"desc"}},matterLinks:{include:{matter:true}}},orderBy:{updatedAt:"desc"}})));
app.get("/api/tasks",async(_req,res)=>res.json(await db.task.findMany({include:{student:true,hold:true},orderBy:{dueDate:"asc"}})));
app.get("/api/matters",async(_req,res)=>res.json(await db.legalMatter.findMany({include:{student:true,holdLinks:{include:{hold:true}}},orderBy:{updatedAt:"desc"}})));
const holdInput=z.object({studentId:z.string(),institutionId:z.string(),category:z.string().min(2),name:z.string().min(2),reason:z.string().min(2),department:z.string().min(2),priority:z.enum(["LOW","MEDIUM","HIGH","URGENT"]).default("MEDIUM"),source:z.string().optional()});
app.post("/api/holds",allow("ATTORNEY_ADMIN","LEGAL_STAFF"),async(req,res)=>{const p=holdInput.parse(req.body);const count=await db.hold.count();const h=await db.hold.create({data:{...p,holdId:`HLD-${String(count+1).padStart(5,"0")}`,discoveredAt:new Date(),statusHistory:{create:{toStatus:"REPORTED",actorId:req.actor!.id,reason:"Initial report"}}}});await audit(req.actor!.id,"CREATE","Hold",h.id,undefined,h);res.status(201).json(h);});
app.post("/api/holds/:id/status",allow("ATTORNEY_ADMIN","LEGAL_STAFF"),async(req,res)=>{const p=z.object({status:z.nativeEnum(HoldStatus),reason:z.string().min(2)}).parse(req.body);const old=await db.hold.findUniqueOrThrow({where:{id:req.params.id}});const h=await db.$transaction(async tx=>{const x=await tx.hold.update({where:{id:old.id},data:{status:p.status,version:{increment:1}}});await tx.holdStatusHistory.create({data:{holdId:old.id,fromStatus:old.status,toStatus:p.status,reason:p.reason,actorId:req.actor!.id}});return x});await audit(req.actor!.id,"STATUS_CHANGE","Hold",h.id,{status:old.status},{status:h.status,reason:p.reason});res.json(h);});
app.post("/api/holds/:id/lift",allow("ATTORNEY_ADMIN"),async(req,res)=>{const p=z.object({confirmedBy:z.string().min(2),effectiveAt:z.coerce.date(),proofReference:z.string().min(2),studentRecipient:z.string().email(),supervisorRecipient:z.string().email(),attorneyRecipient:z.string().email()}).parse(req.body);const old=await db.hold.findUniqueOrThrow({where:{id:req.params.id},include:{student:true,tasks:true}});if(old.tasks.some(t=>t.status!=="COMPLETED"&&t.status!=="CANCELLED"))return res.status(409).json({error:"Complete or cancel open tasks before confirming lift"});const result=await db.$transaction(async tx=>{const hold=await tx.hold.update({where:{id:old.id},data:{status:"LIFT_CONFIRMED",liftedAt:p.effectiveAt,liftedBy:p.confirmedBy,version:{increment:1}}});await tx.holdStatusHistory.create({data:{holdId:old.id,fromStatus:old.status,toStatus:"LIFT_CONFIRMED",reason:`Proof: ${p.proofReference}`,actorId:req.actor!.id}});await tx.notification.createMany({data:[["STUDENT",p.studentRecipient],["SUPERVISOR",p.supervisorRecipient],["ATTORNEY",p.attorneyRecipient]].map(([audience,recipient])=>({holdId:old.id,audience,recipient,subject:`Hold ${old.holdId} lifted`,body:"A hold has been confirmed as lifted. Review the matter record for approved details.",status:"DRAFT"}))});await tx.task.create({data:{title:"Verify hold no longer appears in institution system",studentId:old.studentId,holdId:old.id,department:"ITS",assignedTo:req.actor!.name,createdBy:req.actor!.id,dueDate:new Date(p.effectiveAt.getTime()+3*86400000),priority:"HIGH",status:"NOT_STARTED"}});return hold});await audit(req.actor!.id,"LIFT_CONFIRMED","Hold",old.id,{status:old.status},{status:"LIFT_CONFIRMED",proofReference:p.proofReference});res.json(result);});
app.get("/api/audit",allow("ATTORNEY_ADMIN","AUDITOR"),async(_req,res)=>res.json(await db.auditEvent.findMany({take:100,include:{actor:true},orderBy:{createdAt:"desc"}})));
app.use((e:any,_req:any,res:any,_next:any)=>res.status(e?.name==="ZodError"?400:500).json({error:e?.issues||"Unexpected error"}));
app.listen(Number(process.env.PORT||4000),()=>console.log("API on :4000"));
app.get("/api/institutions", async (_req, res) => {
  const institutions = await db.institution.findMany({
    orderBy: {
      name: "asc"
    }
  });

  res.json(institutions);
});