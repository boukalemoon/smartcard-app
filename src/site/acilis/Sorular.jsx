// Sıkça sorulan sorular bölümü.
//
// İçerik burada DEĞİL, sorularVerisi.js'de: aynı veriyi derleme anında
// vite.config.js de okuyup index.html'in <head>'ine schema.org FAQPage olarak
// basıyor. JSON-LD'yi buradan basmıyoruz — iki kopya çıkar ve tarayıcıya göre
// biri hiç görünmez.
//
// Açılış/kapanış <details> ile: JavaScript çalışmasa da içerik açılır, klavye
// ve ekran okuyucu desteği tarayıcıdan gelir, metin kapalıyken de DOM'da
// durduğu için arama motoru görür.
import { ChevronDown } from 'lucide-react'
import { soruGruplari } from './sorularVerisi'
import { BolumBasligi } from './ortak'
import { BOLUM_KAYMA, KAP, ODAK } from './siniflar'

export default function Sorular() {
  const gruplar = soruGruplari()

  return (
    <section id="sorular" className={`${BOLUM_KAYMA} bg-yuzey border-y border-cizgi py-16 lg:py-[88px]`}>
      <div className={`${KAP} flex flex-col gap-10 lg:gap-12`}>
        <BolumBasligi
          ust="Sıkça sorulanlar"
          baslik="Merak edilenler"
          aciklama="Kartın nasıl çalıştığı, nelerin görünür olduğu ve planlar hakkında en çok sorulanlar."
        />
        <div className="grid lg:grid-cols-3 gap-8 lg:gap-10">
          {gruplar.map((g) => (
            <div key={g.ad} className="flex flex-col gap-3">
              <h3 className="font-baslik text-[17px] font-bold">{g.ad}</h3>
              <div className="flex flex-col gap-2">
                {g.maddeler.map((m) => (
                  <details key={m.s} className="group rounded-xl border border-cizgi bg-zemin">
                    <summary
                      className={`${ODAK} flex items-start justify-between gap-3 cursor-pointer list-none p-4 text-[14px] font-semibold rounded-xl`}
                    >
                      {m.s}
                      <ChevronDown
                        size={17}
                        aria-hidden="true"
                        className="shrink-0 mt-0.5 text-metin-2 transition-transform group-open:rotate-180"
                      />
                    </summary>
                    <p className="px-4 pb-4 text-[14px] leading-relaxed text-metin-2">{m.c}</p>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
