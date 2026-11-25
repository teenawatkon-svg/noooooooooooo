# Bami Bowl — Landing Page ขายบะหมี่กึ่งสำเร็จรูป

เว็บสแตติก (HTML/CSS/JS) ไม่ต้อง build เก็บออเดอร์ใน Google Sheet
และพิมพ์ใบหยิบสินค้า / ใบปะหน้าพัสดุได้จากหน้า `admin.html`

## โครงสร้างไฟล์
```
index.html  product.html  order.html  thankyou.html  admin.html
style.css   script.js     products.json
images/            ← รูปสินค้า (แยกโฟลเดอร์)
apps-script/Code.gs  ← โค้ดฝั่ง Google (ไม่ได้ใช้บน Vercel)
```

## 1) Google Sheet + Apps Script
1. ในชีต ตั้งแถวแรกเป็นหัวคอลัมน์ ตามนี้เป๊ะ:
   `timestamp | orderId | customerName | contact | address | items | skuList | total | note`
2. ส่วนขยาย > Apps Script > วางโค้ดจาก `apps-script/Code.gs`
3. Deploy เป็น Web app (Execute as: Me, Who has access: Anyone)
   - ถ้าใช้ URL เดิม ให้ Manage deployments > Edit > **New version** แล้ว URL จะไม่เปลี่ยน
4. ไฟล์ > แชร์ > เผยแพร่ทางเว็บ > เลือก Sheet1 > รูปแบบ CSV (ใช้ในหน้า admin)

> ถ้า Apps Script เดิมบันทึกแค่ 5 ช่องเก่า (customerName, contact, items, total, note)
> ที่อยู่และรหัส SKU จะไม่ถูกบันทึก ต้องใช้ `Code.gs` นี้แทน

## 2) แก้ค่าที่ต้องเปลี่ยน
- `script.js` → `SENDER` (ชื่อ เบอร์ ที่อยู่ร้าน สำหรับพิมพ์บนใบปะหน้า)
- `products.json` → ราคา น้ำหนัก (`weight_g`) และคำอธิบายจริง
- `images/` → ใส่ `tomyum.jpg`, `pork.jpg`

## 3) ขึ้น GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

## 4) Deploy บน Vercel
1. vercel.com > Add New > Project > เลือก repo นี้
2. Framework Preset: **Other** · Build Command: ว่าง · Output Directory: ว่าง (root)
3. กด Deploy ได้โดเมน `*.vercel.app` ทันที
4. โดเมนของตัวเอง: Project > Settings > Domains > Add

## 5) ขั้นตอนหยิบ-แพ็ค-ส่ง
1. เปิด `/admin.html` ติ๊กออเดอร์ที่จะส่งวันนี้
2. **พิมพ์ใบหยิบสินค้า** → ได้สรุปจำนวนแต่ละ SKU ที่ต้องหยิบ และรายการแยกตามออเดอร์
3. **พิมพ์ใบปะหน้าพัสดุ** → 1 ออเดอร์ต่อ 1 ใบ (100×150 มม.) มีผู้รับ ที่อยู่ รายการในพัสดุ และน้ำหนักรวม

## ข้อควรระวังเรื่องข้อมูลลูกค้า
ชีตที่ "เผยแพร่ทางเว็บ" และหน้า `admin.html` เปิดได้โดยทุกคนที่รู้ลิงก์ ทั้งที่มีชื่อ เบอร์ และที่อยู่ลูกค้า
(เข้าข่ายข้อมูลส่วนบุคคลตาม PDPA) ก่อนเปิดขายจริงควรป้องกันหน้า admin
เช่น Vercel Password Protection / Cloudflare Access และเปลี่ยนไปอ่านข้อมูลผ่าน Apps Script ที่มี token แทน CSV สาธารณะ
