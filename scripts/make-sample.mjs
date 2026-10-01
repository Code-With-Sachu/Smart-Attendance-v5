// Generates samples/CSE_S3_Students_37.xlsx — a demo class list with a title row.
import ExcelJS from "exceljs";
const names = ["Arun Kumar","Rahul Raj","Anjali S","Vishnu P","Neha M","Akhil T","Amal Joseph","Meera Nair","Rahul Raj","Fathima K",
"Gokul Krishnan","Haritha R","Irfan Ali","Jeswin Mathew","Keerthana V","Lakshmi Menon","Rahul Raj K","Nandana S","Nikhil George","Parvathy J",
"Riya Thomas","Sandeep M","Sneha Varghese","Sreehari P","Neha M Das","Thomas Kurian","Varsha B","Vivek Anand","Adithya S","Aiswarya L",
"Basil Jose","Devika R","Ebin Sunny","Gouri Nandana","Hanna Fathima","Jithin Raj","Kavya Suresh"];
const wb = new ExcelJS.Workbook();
const ws = wb.addWorksheet("S3 CSE");
ws.addRow(["Department of Computer Science — S3 CSE (2024 scheme)"]);
ws.addRow([]);
ws.addRow(["Roll No", "Student Name", "Admission No"]);
names.forEach((n, i) => ws.addRow([i + 1, n, `ADM${24000 + i}`]));
await wb.xlsx.writeFile("samples/CSE_S3_Students_37.xlsx");
console.log("wrote samples/CSE_S3_Students_37.xlsx");
