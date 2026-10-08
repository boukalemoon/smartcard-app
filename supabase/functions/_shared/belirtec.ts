// TEK KULLANIMLIK PARTNER BELİRTECİ — veritabanında yalnızca özeti durur
//
// Denetim O-06 (08.10.2026): partner_link_tokens.token düz metin tutuluyordu.
// Veritabanını (ya da bir yedeğini) okuyabilen biri, süresi dolmamış
// belirteçlerle arku-link / tinga-link'ten kimlik alabilirdi.
//
// Artık partner-issue-token belirteci üretir, kullanıcıya DÜZ METNİ verir,
// tabloya SHA-256 özetini yazar. Doğrulama uçları gelen belirtecin özetini
// arar. Şema değişmedi: özet `token` sütununa yazılıyor (birincil anahtar,
// benzersiz). Yayın anında henüz kullanılmamış en fazla 5 dakikalık eski
// belirteçler geçersiz olur; kullanıcı yeniden "İzin ver" der.

export async function belirtecOzeti(belirtec: string): Promise<string> {
  const ozet = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(belirtec));
  return Array.from(new Uint8Array(ozet)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
