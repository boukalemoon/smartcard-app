// KAPATILDI (08.10.2026) — denetim D-15.
//
// Terk edilmiş eski partner SSO ucu (partner_tokens tablosu). 10.09.2026
// ölçümünde partner_tokens ve partner_connections 0 satırdı; güncel akış
// partner_link_tokens + arku-link / tinga-link. Uç canlı kaldığı sürece
// sabit süreli olmayan anahtar karşılaştırması ve atomik olmayan belirteç
// yakmasıyla gereksiz bir saldırı yüzeyiydi.
//
// Önceki sürüm git geçmişinde. Bir partner bu adresi hâlâ çağırıyorsa 410
// alır ve güncel akışa (docs/qrtim-kimlik-entegrasyonu.md) geçmelidir.

Deno.serve(() =>
  new Response(
    JSON.stringify({ error: "Bu servis kapatıldı. Güncel akış: arku-link / tinga-link." }),
    { status: 410, headers: { "Content-Type": "application/json" } },
  )
);
