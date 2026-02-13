
// ==========================================
// 1. ตั้งค่าการเชื่อมต่อ Supabase
// ==========================================
// ใส่ URL ของโปรเจกต์ (ไม่มี /rest/v1 ต่อท้าย)
const SUPABASE_URL = 'https://xofzhkbhdtipvzusqmob.supabase.co'; // เปลี่ยนตรงนี้ "https://xofzhkbhdtipvzusqmob.supabase.co/rest/v1/",

// ใส่ Key 'anon' 'public' (ที่ขึ้นต้นด้วย eyJ...)
const SUPABASE_KEY = 'sb_publishable_w3B4n0vwduCJU6cIRtnFqQ_7TiZQdqP'; // เปลี่ยนเป็นค่า anon public key ตรงนี้ sb_publishable_w3B4n0vwduCJU6cIRtnFqQ_7TiZQdqP

// เริ่มต้น Supabase Client
const { createClient } = supabase;
const _supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ตัวแปรสำหรับจัดการกล้อง
let html5QrCode; 

// ==========================================
// 2. เริ่มทำงานเมื่อเปิดหน้าเว็บ
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // ตรวจสอบว่า Browser รองรับกล้องไหม
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        startScanner();
    } else {
        alert("อุปกรณ์ของคุณไม่รองรับการใช้งานกล้อง หรือไม่ได้เชื่อมต่อผ่าน HTTPS");
    }
});

// ฟังก์ชันเริ่มระบบสแกน
function startScanner() {
    html5QrCode = new Html5Qrcode("reader");

    const config = { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
    };

    // สั่งเปิดกล้อง (เน้นกล้องหลัง: environment)
    html5QrCode.start(
        { facingMode: "environment" }, 
        config,
        onScanSuccess,
        onScanFailure
    ).catch(err => {
        // กรณีเกิด Error (เช่น ไม่อนุญาตให้ใช้กล้อง)
        console.error("Error starting scanner:", err);
        alert("ไม่สามารถเปิดกล้องได้: " + err);
        
        // ลองทางเลือก 2: ถ้าเปิดแบบระบุกล้องไม่ได้ ให้ลองเปิดแบบ UserFacing (กล้องหน้า) หรือ Default
        // html5QrCode.start({ facingMode: "user" }, config, onScanSuccess, onScanFailure);
    });
}

// ==========================================
// 3. เมื่อสแกนเจอ QR Code
// ==========================================
function onScanSuccess(decodedText, decodedResult) {
    console.log(`Scan result: ${decodedText}`);
    
    // สั่งหยุดกล้องชั่วคราว
    if(html5QrCode) {
        html5QrCode.pause(); 
    }

    // ซ่อนหน้าจอกล้อง
    document.getElementById('scan-container').style.display = 'none';
    
    // ไปดึงข้อมูลจาก Supabase
    fetchAssetData(decodedText); 
}

function onScanFailure(error) {
    // ปล่อยผ่าน (ไม่ต้องทำอะไร ข้อมูลจะเยอะเกิน)
    // console.warn(`Code scan error = ${error}`);
}

// ==========================================
// 4. ดึงข้อมูลจากฐานข้อมูล
// ==========================================
async function fetchAssetData(qrCodeText) {
    // แปลงข้อมูล: ตัด URL ทิ้งถ้ามี ให้เหลือแต่รหัส
    // สมมติ QR Code เป็น "https://app.com/asset/7440-001-0001" หรือ "7440-001-0001"
    let assetCode = qrCodeText;
    if (assetCode.includes('/')) {
        const parts = assetCode.split('/');
        assetCode = parts[parts.length - 1]; // เอาส่วนสุดท้าย
    }

    // แสดงข้อความว่ากำลังโหลด
    // (อาจจะเพิ่ม Loading Indicator ในอนาคต)

    // Query ข้อมูลจาก Supabase
    const { data, error } = await _supabase
        .from('assets')
        .select(`
            *,
            locations ( building_name, room_number ),
            asset_statuses ( status_name ),
            categories ( name )
        `)
        .eq('asset_code', assetCode)
        .maybeSingle(); // ใช้ maybeSingle เพื่อกัน Error กรณีไม่เจอข้อมูล

    if (error) {
        alert("เกิดข้อผิดพลาดในการดึงข้อมูล: " + error.message);
        resetScan();
        return;
    }

    if (!data) {
        alert("ไม่พบข้อมูลครุภัณฑ์รหัสนี้ในระบบ! (" + assetCode + ")");
        resetScan();
        return;
    }

    // ถ้าเจอข้อมูล ให้แสดงผล
    showResult(data);
}

// ==========================================
// 5. แสดงผลบนหน้าจอ
// ==========================================
function showResult(asset) {
    const card = document.getElementById('result-card');
    card.classList.remove('hidden'); // ปลดล็อกการซ่อน

    // ใส่ข้อมูลลงใน HTML Element ตาม ID
    setText('asset-code', asset.asset_code);
    setText('asset-name', asset.name || asset.description || 'ไม่มีชื่อ');
    
    // จัดการข้อมูลวันที่ (แปลง format ให้สวยงามแบบไทย)
    if (asset.purchase_date) {
        const dateObj = new Date(asset.purchase_date);
        setText('asset-date', dateObj.toLocaleDateString('th-TH'));
    } else {
        setText('asset-date', '-');
    }

    // จัดการสถานที่
    let locText = "ไม่ระบุสถานที่";
    if (asset.locations) {
        locText = `${asset.locations.building_name || ''} ${asset.locations.room_number ? 'ห้อง ' + asset.locations.room_number : ''}`;
    }
    setText('asset-location', locText);

    // จัดการสถานะ
    if (asset.asset_statuses) {
        setText('asset-status', asset.asset_statuses.status_name);
        // เปลี่ยนสีป้ายสถานะตามคำ (ตัวอย่าง)
        const statusEl = document.getElementById('asset-status');
        if(asset.asset_statuses.status_name === 'ชำรุด') {
            statusEl.className = "px-2 py-1 text-xs rounded-full bg-red-100 text-red-800";
        } else {
            statusEl.className = "px-2 py-1 text-xs rounded-full bg-green-100 text-green-800";
        }
    }

    // จัดการรูปภาพ
    const imgEl = document.getElementById('asset-image');
    const noImgText = document.getElementById('no-image-text');
    
    if (asset.image_url) {
        imgEl.src = asset.image_url;
        imgEl.classList.remove('hidden');
        noImgText.classList.add('hidden');
    } else {
        imgEl.classList.add('hidden');
        noImgText.classList.remove('hidden');
    }
}

// ฟังก์ชันช่วยใส่ข้อความ (Helper)
function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
}

// ==========================================
// 6. ปุ่มรีเซ็ต (สแกนใหม่)
// ==========================================
function resetScan() {
    // ซ่อนการ์ดผลลัพธ์
    document.getElementById('result-card').classList.add('hidden');
    // โชว์กล่องสแกน
    document.getElementById('scan-container').style.display = 'block';
    
    // เริ่มสแกนใหม่ (Resume)
    if(html5QrCode) {
        html5QrCode.resume();
    } else {
        startScanner();
    }
}

// ==========================================
// 7. ฟังก์ชันสแกนจากรูปภาพ (Backup Plan)
// ==========================================
function scanFromFile(inputElement) {
    if (inputElement.files.length === 0) return;

    const imageFile = inputElement.files[0];
    
    // ใช้ Html5Qrcode สแกนไฟล์ภาพ
    const html5QrCode = new Html5Qrcode("reader");
    
    html5QrCode.scanFile(imageFile, true)
        .then(decodedText => {
            // ถ้าเจอ QR Code ในรูป
            console.log("Scan from file result:", decodedText);
            onScanSuccess(decodedText, null);
        })
        .catch(err => {
            // ถ้าสแกนไม่เจอ หรือรูปไม่ชัด
            alert("ไม่พบ QR Code ในรูปภาพนี้ หรือรูปไม่ชัดเจน โปรดลองใหม่อีกครั้ง");
            console.error("Error scanning file:", err);
        });
}

