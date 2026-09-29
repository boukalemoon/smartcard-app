import { supabase } from './supabaseClient'
import { mfaGerekliMi } from './shieldauth'

// BANKA HESABI / FATURA BİLGİSİ YAZIMI
//
// IBAN herkese açık kartta görünüyor; ele geçirilen bir hesapla IBAN'ı
// değiştirmek ziyaretçilerin ödemesini saldırgana yönlendirmek demek. Bu
// yüzden veritabanı bu kolonlarda son 10 dakikada iki adımlı doğrulama ister
// (trg_guard_profile_payment_mfa). Burada önce doğrulatır, sonra yazarız;
// veritabanı yine de reddederse (ör. pencere arada doldu) bir kez daha doğrulatıp
// tekrar deneriz.
//
// Yalnızca bank_accounts / billing_info yazan çağrılar buradan geçer.
// Görünürlük anahtarları (show_*) doğrulama istemez.
const SEBEP = 'Banka ve fatura bilgilerini değiştirmek'

export async function odemeBilgisiniYaz(adimAtla, satir) {
  if (!(await adimAtla({ sebep: SEBEP }))) {
    return { error: { message: 'İki adımlı doğrulama tamamlanmadı' }, iptal: true }
  }
  const yaz = () => supabase.from('profile_payment').upsert(satir, { onConflict: 'profile_id' })
  let sonuc = await yaz()
  if (mfaGerekliMi(sonuc.error)) {
    if (!(await adimAtla({ sebep: SEBEP, zorla: true }))) {
      return { error: { message: 'İki adımlı doğrulama tamamlanmadı' }, iptal: true }
    }
    sonuc = await yaz()
  }
  return sonuc
}
