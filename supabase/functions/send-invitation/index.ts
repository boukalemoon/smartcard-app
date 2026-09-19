// KAPATILDI (20.09.2026) — açık e-posta aktarıcısıydı.
//
// Bu fonksiyon depoda yoktu, yalnızca Supabase'de yaşıyordu (Mart 2026).
// Hiçbir uygulama çağırmıyor (networqr, İlgezdi, Arku, Tınga, nexus-crm
// tarandı); `invitations` tablosu da boş.
//
// Neden kapatıldı:
//   • verify_jwt açık görünüyordu ama projenin herkese açık anon anahtarı da
//     geçerli bir JWT'dir; yani herkes çağırabiliyordu.
//   • Çağıranın o kurumun yöneticisi olup olmadığına bakmıyordu.
//   • org_name ve inviter_name istek gövdesinden alınıp e-posta HTML'ine
//     KAÇIŞSIZ gömülüyordu.
//   Sonuç: geçerli bir kurum kimliği bilen herkes, QRtım'ın doğrulanmış
//   gönderici adresinden, istediği içerikle (oltalama bağlantısı dahil)
//   istediği adrese e-posta attırabiliyordu. Bu hem kullanıcılara zarar
//   hem de alan adının kara listeye girmesi riskiydi.
//
// Kurum daveti yeniden gerekirse: çağıranın is_admin_of_org ile yetkisi
// sunucuda denetlenmeli, kurum adı veritabanından okunmalı, tüm alanlar
// HTML kaçışından geçmeli, gönderim M365 üzerinden ve hız sınırlı olmalı.

Deno.serve(() =>
  new Response(
    JSON.stringify({ error: "Bu servis kapatıldı." }),
    { status: 410, headers: { "Content-Type": "application/json" } },
  )
);
