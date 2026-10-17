// Bekleyen kurum davetleri — panelin en üstünde, yalnızca davet varken.
import { Mail } from 'lucide-react'
import { Kart, Dugme } from '../ui'

export default function DavetBandi({ ctx }) {
  const { davetler, daveteYanitVer, davetIsleniyor } = ctx
  if (!davetler?.length) return null
  return (
    <Kart vurgu="vurgu" className="p-5 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-xl bg-vurgu-acik text-vurgu inline-flex items-center justify-center shrink-0"><Mail size={18} aria-hidden="true" /></span>
        <div>
          <h2 className="font-baslik text-[16px] font-bold">Kurum daveti{davetler.length > 1 ? ` (${davetler.length})` : ''}</h2>
          <p className="text-[13px] text-metin-2 mt-0.5">Kabul ederseniz üyeliğiniz başlar ve kart hareketleriniz o kurumun yöneticisine görünür. Reddederseniz hiçbir veriniz paylaşılmaz.</p>
        </div>
      </div>
      {davetler.map((d) => (
        <div key={d.member_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-yuzey-2 px-3.5 py-2.5">
          <div>
            <div className="font-semibold text-sm">{d.organization_name}</div>
            <div className="text-xs text-metin-2">{d.invited_by_name ? `${d.invited_by_name} davet etti` : 'Davet edildiniz'}</div>
          </div>
          <div className="flex gap-2">
            <Dugme boyut="k" onClick={() => daveteYanitVer(d, false)} disabled={davetIsleniyor === d.member_id}>Reddet</Dugme>
            <Dugme boyut="k" tur="ana" onClick={() => daveteYanitVer(d, true)} disabled={davetIsleniyor === d.member_id}>
              {davetIsleniyor === d.member_id ? 'İşleniyor…' : 'Kabul et'}
            </Dugme>
          </div>
        </div>
      ))}
    </Kart>
  )
}
