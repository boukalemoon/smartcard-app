// Sol menünün altındaki plan kartı (tasarım: PanelGenel / PanelOlcum).
import { Rozet } from '../ui'
import { tarih } from '../bicim'

const PLAN_AD = { free: 'Başlangıç Planı', student: 'Öğrenci Planı', professional: 'Profesyonel Plan', stk: 'STK Özel Plan', business: 'Kurumsal Plan', corporate: 'Kurumsal Plan' }

export default function PlanKarti({ ctx }) {
  const plan = ctx.planBilgisi?.plan || ctx.subscription?.plan || 'free'
  const ucretsiz = plan === 'free'
  const sinir = ctx.planBilgisi?.sinir
  return (
    <div className="rounded-2xl border border-cizgi bg-yuzey p-3.5 flex flex-col gap-1.5">
      <Rozet ton={ucretsiz ? 'notr' : 'aksan'} className="self-start">{PLAN_AD[plan] || plan}</Rozet>
      <span className="text-xs text-metin-2">
        {ucretsiz
          ? `${sinir?.profil ?? 1} kart · ${sinir?.sosyal_medya ?? 3} bağlantı · temel ölçüm`
          : ctx.planBilgisi?.expires_at
            ? `${ctx.subscription?.billing_cycle === 'monthly' ? 'Aylık' : 'Yıllık'} · ${tarih(ctx.planBilgisi.expires_at)} tarihine kadar`
            : 'Aktif'}
      </span>
      <button
        type="button"
        onClick={() => (ucretsiz ? ctx.odemeyiAc('professional', 'yearly') : ctx.bolumDegistir('hesap'))}
        className="self-start text-xs font-semibold text-aksan hover:underline"
      >
        {ucretsiz ? "Profesyonel'e geç" : 'Planı yönet'}
      </button>
    </div>
  )
}
