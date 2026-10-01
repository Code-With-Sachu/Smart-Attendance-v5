// Pure-logic checks for import parsing, roll numbers, phones and reports.  Run: npx tsx scripts/unit-test.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { gridToTable, detectColumns, buildPreview, diffStudents } from "@/lib/import/core";
import { canonicalRoll } from "@/lib/roll";
import { normalizePhone } from "@/lib/phone";
import { buildAttendanceReport } from "@/lib/report";
let pass=0, fail=0;
const ok=(n:string,c:boolean,x?:unknown)=>{if(c)pass++;else fail++;console.log(c?"✓":"✗",n,c?"":JSON.stringify(x))};
const bad=gridToTable([["Reg No","Name of Student"],["01","Arun"],["ABC","V"],["-5","N"],["1.5","H"]]).table;
const d=detectColumns(bad); ok("bad file stays numeric", d.suggestedFormat==="numeric", d);
const pv=buildPreview(bad,d.mapping,"numeric"); ok("ABC/-5/1.5 rejected", pv.errors===3, pv.rows.map(r=>r.issues));
const ids=gridToTable([["Register Number","Student"],["TVE23CS001","A"],["TVE23CS002","B"],["TVE23CS010","C"]]).table;
const di=detectColumns(ids); ok("register IDs → alphanumeric", di.suggestedFormat==="alphanumeric" && di.confidence==="high", di);
ok("01/001/1 equal", ["1","01","001","1.0"].every(v=>(canonicalRoll(v) as any).value==="1"));
ok("0 rejected", !canonicalRoll("0").ok);
const nohdr=gridToTable([["1","Arun Kumar"],["2","Rahul"],["3","Anjali"]]);
const dn=detectColumns(nohdr.table); ok("headerless content heuristic (low confidence)", !nohdr.headerFound && dn.mapping.roll===0 && dn.mapping.name===1 && dn.confidence==="low", dn);
const diff=diffStudents([{id:"a",rollNumber:"1",name:"A",status:"active"},{id:"b",rollNumber:"2",name:"B",status:"inactive"}],[{rollNumber:"2",name:"B"},{rollNumber:"3",name:"C"}]);
ok("diff add/reactivate/remove", diff.added.length===1&&diff.updated[0].reactivated&&diff.removed[0].id==="a", diff);
ok("phone 10-digit→91", (normalizePhone("98765 43210") as any).value==="919876543210");
ok("phone +44", (normalizePhone("+44 7700 900123") as any).value==="447700900123");
ok("phone letters rejected", !normalizePhone("98ab").ok);
const rep=buildAttendanceReport({date:"2026-10-01",time:"09:30",mainModuleName:"CSE S3",subModuleName:"DS",records:[{rollNumber:"3",name:"Anjali S",status:"absent"},{rollNumber:"1",name:"Arun",status:"present"}]},{includePresent:true,includeNames:true});
ok("report format", rep.includes("Date: 01 October 2026") && rep.includes("Time: 09:30 AM") && rep.includes("03 — Anjali S") && rep.indexOf("ABSENT")<rep.indexOf("PRESENT STUDENTS"), rep);
console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
