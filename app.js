// --------------------------------------------------------
// 1. ตั้งค่าการเชื่อมต่อ (เอามาจาก Supabase > Project Settings > API)
// --------------------------------------------------------
const SUPABASE_URL = 'https://xofzhkbhdtipvzusqmob.supabase.co'; // เปลี่ยนตรงนี้ "https://xofzhkbhdtipvzusqmob.supabase.co/rest/v1/",
const SUPABASE_KEY = 'sb_publishable_w3B4n0vwduCJU6cIRtnFqQ_7TiZQdqP'; // เปลี่ยนเป็นค่า anon public key ตรงนี้ sb_publishable_w3B4n0vwduCJU6cIRtnFqQ_7TiZQdqP

// เริ่มต้น Supabase Client
const { createClient } = supabase;
const _supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --------------------------------------------------------
// 2. ฟังก์ชันหลักของแอป
// --------------------------------------------------------

// เมื่อโหลดหน้าเว็บเสร็จ ให้เริ่มเปิดกล้องทันที
document.addEventListener('DOMContentLoaded', () => {
    startScanner();
});

function startScanner() {
    const html5QrcodeScanner = new Html5QrcodeScanner(
        "reader", { fps: 10, qrbox: 250 }
    );
    
    html5QrcodeScanner.render(onScanSuccess, onScanFailure);
    
    // ฟังก์ชันทำงานเมื่อสแกนเจอ
    function onScanSuccess(decodedText, decodedResult) {
        console.log(`Scan result: ${decodedText}`);
        
        // หยุดกล้องเพื่อไม่ให้เปลืองแบตและหยุดสแกนซ้ำ
        html5QrcodeScanner.clear();
        document.getElementById('scan-container').style.display = 'none';
        
        // เรียกดึงข้อมูลจาก Supabase
        fetchAssetData(decodedText); 
    }

    function onScanFailure(error) {
        // ส่วนนี้ไม่ต้องทำอะไรมาก กัน Error รก Console
    }
}

// ฟังก์ชันดึงข้อมูลจากฐานข้อมูล
async function fetchAssetData(qrCodeText) {
    // สมมติว่า QR Code เก็บเป็น URL เราจะตัดเอาแค่รหัสท้ายสุด หรือถ้าเก็บเป็นรหัสเลยก็ใช้ได้เลย
    // ตัวอย่างนี้สมมติว่า QR คือรหัสครุภัณฑ์เพียวๆ เช่น "7440-001-0001"
    const assetCode = qrCodeText.replace('https://your-app.com/asset/', ''); 

    // คำสั่ง Query ข้อมูล (เหมือน SQL: SELECT * FROM assets WHERE asset_code = ...)
    const { data, error } = await _supabase
        .from('assets')
        .select(`
            *,
            locations ( building_name, room_number ),
            asset_statuses ( status_name )
        `)
        .eq('asset_code', assetCode)
        .single();

    if (error || !data) {
        alert("ไม่พบข้อมูลครุภัณฑ์นี้ในระบบ! (" + assetCode + ")");
        resetScan(); // กลับไปหน้าสแกน
        return;
    }

    // แสดงผลข้อมูลบนหน้าจอ
    showResult(data);
}

// ฟังก์ชันเอาข้อมูลไปแปะใน HTML
function showResult(asset) {
    const card = document.getElementById('result-card');
    card.classList.remove('hidden'); // โชว์การ์ด

    // ใส่ข้อมูลข้อความ
    document.getElementById('asset-code').innerText = asset.asset_code;
    document.getElementById('asset-name').innerText = asset.name || asset.description;
    
    // จัดการสถานที่ (ถ้ามีข้อมูล)
    let locText = "ไม่ระบุ";
    if (asset.locations) {
        locText = `${asset.locations.building_name} ${asset.locations.room_number ? 'ห้อง ' + asset.locations.room_number : ''}`;
    }
    document.getElementById('asset-location').innerText = locText;

    // วันที่
    document.getElementById('asset-date').innerText = asset.purchase_date || '-';

    // สถานะ
    if (asset.asset_statuses) {
        document.getElementById('asset-status').innerText = asset.asset_statuses.status_name;
    }

    // รูปภาพ (ถ้ามี Image URL)
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

// ปุ่มสแกนใหม่
function resetScan() {
    location.reload(); // รีโหลดหน้าเพื่อเริ่มใหม่ (ง่ายที่สุด)
}