// Üst bölüm: kartın başı — ad, unvan, şirket, fotoğraf, kapak ve tema rengi.
// Ad/unvan/şirket profilin temel bilgileridir (tüm profiller kullanır);
// "bu profilde görünen ad" yalnız seçili profile özeldir.
import { useState } from 'react'
import { Kart, Avatar, Dugme, Girdi, Alan } from '../../ui'
import { GorselYukle, GorunurlukSecici, RenkSecici, SeviyeRozeti } from './parcalar'
import { alanDegeri, ortakSeviye } from './yardim'

function Form({ ctx, editor, islem, renk, onBitti }) {
  const p = ctx.profile || {}
  const [d, setD] = useState({ name: p.name || '', title: p.title || '', company: p.company || '', gorunen: editor.persona?.display_name || '' })
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const alanlar = ['title', 'company'].map((k) => editor.fields.find((f) => f.key === k)).filter(Boolean)

  const kaydet = async (e) => {
    e.preventDefault()
    setKaydediliyor(true)
    const tamam = await islem.ustBilgiKaydet(d)
    setKaydediliyor(false)
    if (tamam) onBitti()
  }

  return (
    <form onSubmit={kaydet} className="flex flex-col gap-4 border-t border-cizgi pt-4">
      <div className="grid sm:grid-cols-3 gap-3">
        <Alan etiket="Ad soyad" id="ust-ad"><Girdi id="ust-ad" value={d.name} maxLength={100} onChange={(e) => setD({ ...d, name: e.target.value })} className="h-10 text-[14px]" /></Alan>
        <Alan etiket="Unvan" id="ust-unvan"><Girdi id="ust-unvan" value={d.title} maxLength={100} onChange={(e) => setD({ ...d, title: e.target.value })} className="h-10 text-[14px]" /></Alan>
        <Alan etiket="Şirket / kurum" id="ust-sirket"><Girdi id="ust-sirket" value={d.company} maxLength={100} onChange={(e) => setD({ ...d, company: e.target.value })} className="h-10 text-[14px]" /></Alan>
      </div>
      <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-start">
        <Alan etiket="Bu profilde görünen ad" id="ust-gorunen" ipucu="Boş bırakırsanız ad soyadınız görünür. Yalnız bu profili etkiler.">
          <Girdi id="ust-gorunen" value={d.gorunen} maxLength={80} placeholder={d.name} onChange={(e) => setD({ ...d, gorunen: e.target.value })} className="h-10 text-[14px]" />
        </Alan>
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold">Unvan ve şirket</span>
          <GorunurlukSecici etiket="Unvan ve şirket görünürlüğü" deger={ortakSeviye(alanlar)} onChange={(v) => islem.alanlarAyarla(['title', 'company'], v)} className="sm:w-[170px]" />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <GorselYukle kova="avatars" kare etiket="Profil fotoğrafı" mevcut={p.avatar_url} bildir={ctx.showToast} onYuklendi={(url) => ctx.updateAvatar(url)} />
        <GorselYukle kova="backgrounds" maksMb={5} etiket="Kapak görseli" mevcut={p.background_image_url} bildir={ctx.showToast} onYuklendi={islem.kapakKaydet} onKaldir={() => islem.kapakKaydet(null)} />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold">Tema rengi</span>
        <RenkSecici deger={renk} onSec={islem.temaKaydet} />
      </div>
      <div className="flex gap-2 justify-end">
        <Dugme tur="sessiz" onClick={onBitti}>Vazgeç</Dugme>
        <Dugme type="submit" tur="ana" disabled={kaydediliyor}>{kaydediliyor ? 'Kaydediliyor…' : 'Kaydet'}</Dugme>
      </div>
    </form>
  )
}

export default function UstBolum({ ctx, editor, islem, renk }) {
  const [duzenle, setDuzenle] = useState(false)
  const p = ctx.profile || {}
  const x = editor.persona || {}
  const deger = (k) => alanDegeri(editor.fields.find((f) => f.key === k))
  const ad = x.display_name || p.name || 'Adınızı ekleyin'
  const alt = [deger('title'), deger('company')].filter(Boolean)
  const seviye = ortakSeviye(['title', 'company'].map((k) => editor.fields.find((f) => f.key === k)).filter(Boolean))
  const dogrulanan = editor.fields.filter((f) => f.verified).map((f) => f.label)
  const kapak = p.background_image_url ? 'kapak görseli' : `tema ${String(renk || '').toUpperCase()}`

  return (
    <Kart className="p-5 flex flex-col gap-3" aria-labelledby="kartim-ust">
      <div className="flex justify-between items-center">
        <h2 id="kartim-ust" className="font-baslik text-[15px] font-bold">Üst bölüm</h2>
        <Dugme tur="sessiz" boyut="k" aria-expanded={duzenle} onClick={() => setDuzenle((v) => !v)}>{duzenle ? 'Kapat' : 'Düzenle'}</Dugme>
      </div>
      <div className="flex gap-3.5 items-center flex-wrap">
        <Avatar ad={ad} url={x.avatar_url || p.avatar_url} boyut={56} ton={0} />
        <div className="flex-1 min-w-[180px]">
          <div className="text-[14px]"><b>{ad}</b>{alt.length > 0 && <span> · {alt.join(' · ')}</span>}</div>
          <div className="text-xs text-metin-2">
            Kapak: {kapak}{dogrulanan.length ? ` · doğrulanan: ${dogrulanan.join(', ').toLocaleLowerCase('tr-TR')}` : ''}
          </div>
        </div>
        <div className="flex gap-1.5 items-center text-xs text-metin-2">Ad, unvan, şirket: <SeviyeRozeti deger={seviye} /></div>
      </div>
      {duzenle && <Form ctx={ctx} editor={editor} islem={islem} renk={renk} onBitti={() => setDuzenle(false)} />}
    </Kart>
  )
}
