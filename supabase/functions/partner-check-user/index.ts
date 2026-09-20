// KAPATILDI (20.09.2026) — kullanan kalmadı.
//
// Bu uç oturum istemiyordu; yalnızca partner anahtarıyla çalışıp e-postayı
// bilene kişinin ADINI ve KULLANICI ADINI veriyordu. Yani bir kullanıcı
// sorgulama servisiydi ve anahtarlardan biri bir istemci paketine girseydi
// herkese açık hale gelirdi.
//
// Üç bağımsız tarama sonucunda çağıran bulunamadı:
//   • QRtım (networqr): çağrı yok.
//   • İlgezdi oturumu: "ILGEZDI_API_KEY istemcide yok, bu ucu hiç çağırmıyoruz".
//   • Nexus CRM oturumu: altı CRM deposunda çağrı yok, CRM_API_KEY hiçbir
//     yerde tanımlı değil.
//   • Arku deposu (arku-remote-main) da tarandı: çağrı yok.
//
// Geri açmak gerekirse bu dosyanın önceki sürümü git geçmişinde duruyor
// (sabit süreli anahtar karşılaştırması, dakikalık sınır ve maskeli denetim
// kaydıyla birlikte). Yeniden açılırsa: anahtar YALNIZCA sunucu tarafında
// tutulmalı ve yanıt yalnız "var/yok" döndürmeli — ad ve kullanıcı adı
// vermemeli.

Deno.serve(() =>
  new Response(
    JSON.stringify({ error: "Bu servis kapatıldı." }),
    { status: 410, headers: { "Content-Type": "application/json" } },
  )
);
