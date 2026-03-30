export type Lang = "en" | "th";

type T = Record<string, { en: string; th: string }>;

export const t: T = {
  // ── Header ────────────────────────────────────────────────────────────────
  pageTitle:    { en: "Commodities Guide",              th: "คู่มือสินค้าโภคภัณฑ์" },
  pageDesc:     { en: "A beginner-friendly introduction to trading commodities — gold, silver, oil, and more — using NextGen Trading.", th: "บทนำสำหรับผู้เริ่มต้นในการเทรดสินค้าโภคภัณฑ์ — ทองคำ เงิน น้ำมัน และอื่น ๆ ผ่าน NextGen Trading" },

  // ── Section titles ────────────────────────────────────────────────────────
  sectionWhat:      { en: "What are Commodities?",               th: "สินค้าโภคภัณฑ์คืออะไร?" },
  sectionTerms:     { en: "Key Terms & Definitions",             th: "คำศัพท์สำคัญและคำนิยาม" },
  sectionHowTo:     { en: "How to Use the Commodities Section",  th: "วิธีใช้งานส่วนสินค้าโภคภัณฑ์" },
  sectionSignal:    { en: "Understanding the Signal Engine",     th: "ทำความเข้าใจเครื่องมือสัญญาณ" },
  sectionSymbols:   { en: "Supported Symbols & How to Enter Them", th: "สัญลักษณ์ที่รองรับและวิธีพิมพ์" },
  sectionRisk:      { en: "Risk Management for Beginners",       th: "การจัดการความเสี่ยงสำหรับผู้เริ่มต้น" },
  sectionFaq:       { en: "Frequently Asked Questions",          th: "คำถามที่พบบ่อย" },
  sectionAlerts:    { en: "Setting Up Commodity Alerts",         th: "การตั้งค่าการแจ้งเตือนสินค้าโภคภัณฑ์" },

  // ── What are commodities ──────────────────────────────────────────────────
  whatP1: {
    en: "Commodities are raw materials or primary agricultural products that can be bought and sold. Unlike stocks (which represent ownership in a company), commodities are physical goods with real-world supply and demand.",
    th: "สินค้าโภคภัณฑ์คือวัตถุดิบหรือผลิตภัณฑ์การเกษตรขั้นต้นที่สามารถซื้อขายได้ ต่างจากหุ้น (ที่แสดงถึงความเป็นเจ้าของในบริษัท) สินค้าโภคภัณฑ์คือสินค้าจริงที่มีอุปสงค์และอุปทานในโลกความเป็นจริง",
  },
  whatP2:   { en: "There are four main categories:", th: "มีสี่หมวดหมู่หลัก:" },
  catMetals: { en: "Metals",  th: "โลหะ" },
  catEnergy: { en: "Energy",  th: "พลังงาน" },
  catForex:  { en: "Forex",   th: "ฟอเร็กซ์" },
  catCrypto: { en: "Crypto",  th: "คริปโต" },
  catMetalsEx: { en: "Gold (GC), Silver (SI), Copper (HG), Platinum (PL)",         th: "ทองคำ (GC), เงิน (SI), ทองแดง (HG), แพลทินัม (PL)" },
  catEnergyEx: { en: "Crude Oil (CL), Natural Gas (NG), Brent Oil (BZ)",           th: "น้ำมันดิบ (CL), ก๊าซธรรมชาติ (NG), น้ำมันเบรนท์ (BZ)" },
  catForexEx:  { en: "EUR/USD, GBP/USD, USD/JPY — currency exchange rates",        th: "EUR/USD, GBP/USD, USD/JPY — อัตราแลกเปลี่ยนเงินตรา" },
  catCryptoEx: { en: "Bitcoin (BTC-USD), Ethereum (ETH-USD), Solana (SOL-USD)",    th: "บิตคอยน์ (BTC-USD), อีเธอเรียม (ETH-USD), โซลานา (SOL-USD)" },
  whatCallout: {
    en: "In NextGen Trading, commodities are accessed via the Commodities menu. You can view live signals, risk metrics, and performance for any supported symbol.",
    th: "ใน NextGen Trading สินค้าโภคภัณฑ์จะเข้าถึงได้ผ่านเมนู Commodities คุณสามารถดูสัญญาณสด ตัวชี้วัดความเสี่ยง และผลการดำเนินงานสำหรับสัญลักษณ์ที่รองรับ",
  },

  // ── Terms ─────────────────────────────────────────────────────────────────
  termsIntro: { en: "Learn the vocabulary before you trade.", th: "เรียนรู้คำศัพท์ก่อนที่จะเทรด" },

  termFuturesName:   { en: "Futures Contract",      th: "สัญญาซื้อขายล่วงหน้า" },
  termFuturesDef:    { en: "An agreement to buy or sell a commodity at a set price on a future date. Example: GCM26 = Gold futures expiring June 2026.", th: "ข้อตกลงในการซื้อหรือขายสินค้าโภคภัณฑ์ในราคาที่กำหนดในวันที่กำหนดในอนาคต เช่น GCM26 = สัญญาทองคำที่หมดอายุในเดือนมิถุนายน 2026" },
  termSpotName:      { en: "Spot Price",             th: "ราคาสปอต" },
  termSpotDef:       { en: "The current market price for immediate delivery of a commodity. The price you see on news sites is usually the spot price.", th: "ราคาตลาดปัจจุบันสำหรับการส่งมอบทันที ราคาที่คุณเห็นในข่าวมักเป็นราคาสปอต" },
  termFrontName:     { en: "Front-Month (GC=F)",     th: "สัญญาใกล้หมดอายุ (GC=F)" },
  termFrontDef:      { en: "The nearest futures contract — the one expiring soonest. Most liquid and closest to the spot price. Written as GC=F in this platform.", th: "สัญญาซื้อขายล่วงหน้าที่ใกล้หมดอายุที่สุด มีสภาพคล่องสูงสุดและใกล้เคียงราคาสปอตมากที่สุด เขียนเป็น GC=F ในแพลตฟอร์มนี้" },
  termMonthName:     { en: "Contract Month Code",    th: "รหัสเดือนสัญญา" },
  termMonthDef:      { en: "A letter representing the expiry month: F=Jan, G=Feb, H=Mar, J=Apr, K=May, M=Jun, N=Jul, Q=Aug, U=Sep, V=Oct, X=Nov, Z=Dec.", th: "ตัวอักษรแทนเดือนที่หมดอายุ: F=ม.ค., G=ก.พ., H=มี.ค., J=เม.ย., K=พ.ค., M=มิ.ย., N=ก.ค., Q=ส.ค., U=ก.ย., V=ต.ค., X=พ.ย., Z=ธ.ค." },
  termEmaName:       { en: "EMA",                    th: "ค่าเฉลี่ยเคลื่อนที่แบบเอ็กซ์โพเนนเชียล (EMA)" },
  termEmaDef:        { en: "A moving average that gives more weight to recent prices. EMA-8 reacts fast; EMA-21 is slower. When EMA-8 crosses above EMA-21, it suggests upward momentum.", th: "ค่าเฉลี่ยเคลื่อนที่ที่ให้น้ำหนักกับราคาล่าสุดมากขึ้น EMA-8 ตอบสนองเร็ว EMA-21 ช้ากว่า เมื่อ EMA-8 ข้ามขึ้นเหนือ EMA-21 แสดงถึงแรงขับเคลื่อนขาขึ้น" },
  termRsiName:       { en: "RSI",                    th: "ดัชนีความแข็งแกร่งสัมพัทธ์ (RSI)" },
  termRsiDef:        { en: "A 0–100 momentum oscillator. Above 70 = potentially overbought. Below 30 = potentially oversold.", th: "ออสซิลเลเตอร์โมเมนตัม 0–100 มากกว่า 70 = อาจซื้อมากเกินไป น้อยกว่า 30 = อาจขายมากเกินไป" },
  termVolName:       { en: "Volume",                 th: "ปริมาณการซื้อขาย" },
  termVolDef:        { en: "The number of contracts traded in a period. High volume on a price move confirms the move is real.", th: "จำนวนสัญญาที่ซื้อขายในช่วงเวลา ปริมาณสูงบนการเคลื่อนไหวของราคายืนยันว่าการเคลื่อนไหวนั้นเป็นจริง" },
  termConfName:      { en: "Confidence Score",       th: "คะแนนความเชื่อมั่น" },
  termConfDef:       { en: "A 0–100 score computed by the signal engine. Higher = more conditions aligned for a buy entry. Not a guarantee of profit.", th: "คะแนน 0–100 ที่คำนวณโดยเครื่องมือสัญญาณ ยิ่งสูงยิ่งมีเงื่อนไขที่สอดคล้องกันมากสำหรับการเข้าซื้อ ไม่ใช่การรับประกันกำไร" },
  termBuyZoneName:   { en: "Buy Zone",               th: "โซนซื้อ" },
  termBuyZoneDef:    { en: "A price range where the model considers entry historically favorable based on past patterns.", th: "ช่วงราคาที่โมเดลพิจารณาว่าการเข้าซื้อนั้นดีในอดีตจากรูปแบบที่ผ่านมา" },
  termContangoName:  { en: "Contango",               th: "คอนแทงโก" },
  termContangoDef:   { en: "When future prices are higher than the spot price — normal for gold/oil. Storage costs and interest rates drive this.", th: "เมื่อราคาฟิวเจอร์สสูงกว่าราคาสปอต ปกติสำหรับทองคำ/น้ำมัน ต้นทุนการจัดเก็บและอัตราดอกเบี้ยเป็นปัจจัยหลัก" },
  termBackName:      { en: "Backwardation",          th: "แบ็กเวิร์เดชัน" },
  termBackDef:       { en: "When futures prices are lower than spot — unusual, often signals tight supply.", th: "เมื่อราคาฟิวเจอร์สต่ำกว่าราคาสปอต ผิดปกติ มักบ่งบอกถึงอุปทานที่ตึงตัว" },
  termLevName:       { en: "Leverage",               th: "เลเวอเรจ" },
  termLevDef:        { en: "Borrowing to control a larger position. 2× leverage means a 1% price move = 2% gain or loss. Amplifies both wins and losses.", th: "การกู้ยืมเพื่อควบคุมตำแหน่งที่ใหญ่ขึ้น เลเวอเรจ 2× หมายความว่าการเคลื่อนไหวราคา 1% = กำไรหรือขาดทุน 2% ขยายทั้งกำไรและขาดทุน" },
  termDDName:        { en: "Drawdown",               th: "การลดลงสูงสุด (Drawdown)" },
  termDDDef:         { en: "The peak-to-trough decline in your account. A 10% drawdown means your balance fell 10% from its high point.", th: "การลดลงจากจุดสูงสุดถึงจุดต่ำสุดในบัญชีของคุณ Drawdown 10% หมายความว่ายอดคงเหลือลดลง 10% จากจุดสูงสุด" },
  termSignalName:    { en: "Signal",                 th: "สัญญาณ" },
  termSignalDef:     { en: "An algorithmically generated suggestion that conditions look favorable for a trade. Always requires your own judgment.", th: "คำแนะนำที่สร้างโดยอัลกอริทึมว่าเงื่อนไขดูเอื้ออำนวยต่อการเทรด ต้องใช้วิจารณญาณของคุณเองเสมอ" },

  // ── How to use ────────────────────────────────────────────────────────────
  step1Title: { en: "Open the Commodities menu",        th: "เปิดเมนู Commodities" },
  step1Body:  { en: "In the left sidebar, click Commodities. It expands to reveal four sub-pages: Overview, Signals, Performance, and Risk.", th: "ในแถบด้านซ้าย คลิก Commodities จะขยายเพื่อแสดงสี่หน้าย่อย: ภาพรวม สัญญาณ ผลการดำเนินงาน และความเสี่ยง" },
  step2Title: { en: "Choose a symbol",                  th: "เลือกสัญลักษณ์" },
  step2Body:  { en: "On the Overview page, select a symbol from the dropdown — e.g. XAUUSD (Gold), XAGUSD (Silver), USOIL (WTI Crude). You can also type a specific futures contract like GCM26 directly in the dashboard chart.", th: "ในหน้าภาพรวม เลือกสัญลักษณ์จากเมนูแบบเลื่อนลง เช่น XAUUSD (ทองคำ), XAGUSD (เงิน), USOIL (น้ำมันดิบ) คุณยังสามารถพิมพ์สัญญาเฉพาะเจาะจง เช่น GCM26 ในกราฟแดชบอร์ดได้โดยตรง" },
  step3Title: { en: "Read the signal",                  th: "อ่านสัญญาณ" },
  step3Body:  { en: "The signal engine checks 4 conditions: EMA-8 > EMA-21, price above EMA-50, RSI below 70, and volume ≥ 105% of the 20-day average. All four must pass for a buy signal.", th: "เครื่องมือสัญญาณตรวจสอบ 4 เงื่อนไข: EMA-8 > EMA-21, ราคาอยู่เหนือ EMA-50, RSI ต่ำกว่า 70 และปริมาณ ≥ 105% ของค่าเฉลี่ย 20 วัน ทั้งสี่เงื่อนไขต้องผ่านจึงจะเกิดสัญญาณซื้อ" },
  step4Title: { en: "Check the Risk page",              th: "ตรวจสอบหน้าความเสี่ยง" },
  step4Body:  { en: "Before acting on any signal, review the Risk page. It shows current volatility, recent drawdown, and market regime.", th: "ก่อนดำเนินการตามสัญญาณ ให้ตรวจสอบหน้าความเสี่ยง แสดงความผันผวนปัจจุบัน Drawdown ล่าสุด และสภาพตลาด" },
  step5Title: { en: "Review Performance history",       th: "ตรวจสอบประวัติผลการดำเนินงาน" },
  step5Body:  { en: "The Performance page shows how past signals performed. More wins in a trending market does not guarantee future results.", th: "หน้าผลการดำเนินงานแสดงว่าสัญญาณในอดีตทำงานอย่างไร ชนะมากขึ้นในตลาดที่มีแนวโน้มไม่ได้รับประกันผลในอนาคต" },
  step6Title: { en: "Set up Alerts (optional)",         th: "ตั้งค่าการแจ้งเตือน (ไม่บังคับ)" },
  step6Body:  { en: "Go to Profile → Notification Preferences to enable email or SMS alerts when a buy signal fires for your chosen symbols.", th: "ไปที่ โปรไฟล์ → การตั้งค่าการแจ้งเตือน เพื่อเปิดใช้งานการแจ้งเตือนทางอีเมลหรือ SMS เมื่อสัญญาณซื้อเกิดขึ้นสำหรับสัญลักษณ์ที่คุณเลือก" },
  howToCallout: {
    en: "Start with the front-month continuous contract (GC=F, SI=F) before exploring specific contract months. Front-month contracts are the most liquid and have the cleanest data.",
    th: "เริ่มต้นด้วยสัญญาเดือนใกล้หมดอายุแบบต่อเนื่อง (GC=F, SI=F) ก่อนที่จะสำรวจสัญญาเดือนเฉพาะเจาะจง สัญญาเดือนใกล้หมดอายุมีสภาพคล่องสูงสุดและข้อมูลที่สะอาดที่สุด",
  },

  // ── Signal engine ─────────────────────────────────────────────────────────
  signalIntro: { en: "The platform uses a 4-condition gate. All four must pass for a buy signal to fire:", th: "แพลตฟอร์มใช้เกต 4 เงื่อนไข ทั้งสี่ต้องผ่านเพื่อให้สัญญาณซื้อเกิดขึ้น:" },
  gate1Meaning: { en: "Short-term momentum is above medium-term — uptrend is in play.",              th: "โมเมนตัมระยะสั้นสูงกว่าระยะกลาง — แนวโน้มขาขึ้นกำลังดำเนินอยู่" },
  gate2Meaning: { en: "Price is above the 50-period average — medium-term trend is up.",            th: "ราคาอยู่เหนือค่าเฉลี่ย 50 ช่วง — แนวโน้มระยะกลางเป็นขาขึ้น" },
  gate3Meaning: { en: "Not yet overbought — there is still room to run before a potential reversal.", th: "ยังไม่ซื้อมากเกินไป — ยังมีพื้นที่วิ่งก่อนการกลับตัวที่อาจเกิดขึ้น" },
  gate4Meaning: { en: "Participation is above normal — the move has conviction behind it.",          th: "การมีส่วนร่วมสูงกว่าปกติ — การเคลื่อนไหวมีความเชื่อมั่นรองรับ" },
  signalWarning: {
    en: "A signal is a historically favorable entry zone, not a guaranteed outcome. Commodity prices are affected by geopolitical events, central bank decisions, and supply shocks that no algorithm can predict.",
    th: "สัญญาณคือโซนเข้าซื้อที่ดีในอดีต ไม่ใช่ผลลัพธ์ที่รับประกัน ราคาสินค้าโภคภัณฑ์ได้รับผลกระทบจากเหตุการณ์ทางภูมิรัฐศาสตร์ การตัดสินใจของธนาคารกลาง และการช็อคอุปทานที่ไม่มีอัลกอริทึมใดทำนายได้",
  },

  // ── Symbols table ─────────────────────────────────────────────────────────
  symColInput: { en: "You type",  th: "พิมพ์" },
  symColAsset: { en: "Asset",     th: "สินทรัพย์" },
  symColNote:  { en: "Notes",     th: "หมายเหตุ" },
  symCallout: {
    en: "Contract month codes: F=Jan G=Feb H=Mar J=Apr K=May M=Jun N=Jul Q=Aug U=Sep V=Oct X=Nov Z=Dec",
    th: "รหัสเดือนสัญญา: F=ม.ค. G=ก.พ. H=มี.ค. J=เม.ย. K=พ.ค. M=มิ.ย. N=ก.ค. Q=ส.ค. U=ก.ย. V=ต.ค. X=พ.ย. Z=ธ.ค.",
  },

  // ── Risk ──────────────────────────────────────────────────────────────────
  riskIntro: { en: "Commodities can move fast. Before placing any trade:", th: "สินค้าโภคภัณฑ์สามารถเคลื่อนไหวเร็ว ก่อนวางออเดอร์ใดๆ:" },
  risk1: { en: "Never risk more than 1–2% of your account on a single trade.", th: "อย่าเสี่ยงมากกว่า 1–2% ของบัญชีในการเทรดครั้งเดียว" },
  risk2: { en: "Use the Risk page to check current volatility. High-volatility regimes require smaller position sizes.", th: "ใช้หน้าความเสี่ยงเพื่อตรวจสอบความผันผวนปัจจุบัน ช่วงความผันผวนสูงต้องการขนาดตำแหน่งที่เล็กลง" },
  risk3: { en: "Set a stop-loss before you enter — know your exit before your entry.", th: "ตั้ง Stop-Loss ก่อนเข้า — รู้จุดออกก่อนจุดเข้า" },
  risk4: { en: "Signals are based on daily data by default. Intraday noise is higher; shorter intervals produce more false signals.", th: "สัญญาณอ้างอิงข้อมูลรายวันโดยค่าเริ่มต้น สัญญาณรบกวนในวันมีสูงกว่า ช่วงเวลาที่สั้นกว่าสร้างสัญญาณเท็จมากขึ้น" },
  risk5: { en: "Past signal performance does not predict future returns.", th: "ผลการดำเนินงานของสัญญาณในอดีตไม่ได้ทำนายผลตอบแทนในอนาคต" },
  risk6: { en: "Leverage amplifies losses as much as gains. Start without leverage until you understand the asset.", th: "เลเวอเรจขยายขาดทุนเท่ากับกำไร เริ่มต้นโดยไม่ใช้เลเวอเรจจนกว่าคุณจะเข้าใจสินทรัพย์" },
  riskDisclaimerBody: {
    en: "This platform provides informational signals only. It does not execute commodity trades on your behalf. Always consult a qualified financial adviser before trading leveraged instruments.",
    th: "แพลตฟอร์มนี้ให้สัญญาณเพื่อการศึกษาเท่านั้น ไม่ได้ดำเนินการเทรดสินค้าโภคภัณฑ์แทนคุณ ปรึกษาที่ปรึกษาทางการเงินที่มีคุณสมบัติก่อนเทรดเครื่องมือที่มีเลเวอเรจเสมอ",
  },

  // ── FAQ ───────────────────────────────────────────────────────────────────
  faq1q: { en: "What is the difference between GC=F and GCM26?", th: "GC=F และ GCM26 ต่างกันอย่างไร?" },
  faq1a: { en: "GC=F is the continuous front-month gold futures contract — it automatically rolls to the nearest expiry. GCM26 is a specific contract expiring June 2026. Use GC=F for general trend analysis; use specific contracts if you are trading that exact expiry.", th: "GC=F คือสัญญาทองคำฟิวเจอร์สแบบต่อเนื่อง จะต่ออายุอัตโนมัติ GCM26 คือสัญญาเฉพาะที่หมดอายุมิถุนายน 2026 ใช้ GC=F สำหรับการวิเคราะห์แนวโน้มทั่วไป ใช้สัญญาเฉพาะหากคุณเทรดการหมดอายุนั้น" },
  faq2q: { en: "Why does the signal say 'no data' for my symbol?", th: "ทำไมสัญญาณแสดงว่า 'ไม่มีข้อมูล' สำหรับสัญลักษณ์ของฉัน?" },
  faq2a: { en: "Some symbols require exact formatting. Try using the standard forms listed in the Supported Symbols table. For specific contract months, the platform automatically appends the correct exchange suffix (e.g. .CMX for COMEX gold).", th: "สัญลักษณ์บางอย่างต้องการรูปแบบที่ถูกต้อง ลองใช้รูปแบบมาตรฐานที่แสดงในตารางสัญลักษณ์ที่รองรับ สำหรับสัญญาเดือนเฉพาะ แพลตฟอร์มจะเพิ่มคำต่อท้ายตลาดหลักทรัพย์ที่ถูกต้องโดยอัตโนมัติ" },
  faq3q: { en: "The confidence score is 80 — should I trade?", th: "คะแนนความเชื่อมั่นอยู่ที่ 80 — ควรเทรดไหม?" },
  faq3a: { en: "The confidence score reflects alignment of technical conditions, not certainty of profit. An 80 score means all 4 conditions pass with strong values — a historically favorable setup, not a guarantee. Always apply your own risk management.", th: "คะแนนความเชื่อมั่นสะท้อนถึงความสอดคล้องของเงื่อนไขทางเทคนิค ไม่ใช่ความแน่นอนของกำไร คะแนน 80 หมายความว่าเงื่อนไขทั้ง 4 ผ่านด้วยค่าที่แข็งแกร่ง เป็นการตั้งค่าที่ดีในอดีต ไม่ใช่การรับประกัน ใช้การจัดการความเสี่ยงของคุณเองเสมอ" },
  faq4q: { en: "How often do signals update?",    th: "สัญญาณอัปเดตบ่อยแค่ไหน?" },
  faq4a: { en: "Signal data refreshes every 15 minutes via the scheduler. The dashboard chart refreshes every 30 seconds. Daily-interval signals are most reliable; intraday signals are more volatile.", th: "ข้อมูลสัญญาณรีเฟรชทุก 15 นาทีผ่าน scheduler กราฟแดชบอร์ดรีเฟรชทุก 30 วินาที สัญญาณช่วงเวลารายวันน่าเชื่อถือที่สุด สัญญาณภายในวันมีความผันผวนมากกว่า" },
  faq5q: { en: "What does the RSI below 70 condition mean?", th: "เงื่อนไข RSI ต่ำกว่า 70 หมายความว่าอะไร?" },
  faq5a: { en: "RSI above 70 traditionally means a market is overbought — it may be due for a pullback. The signal engine waits for RSI to be below 70 to avoid entering at the top of a move.", th: "RSI มากกว่า 70 ตามแบบแผนหมายความว่าตลาดซื้อมากเกินไป อาจถึงเวลาที่จะถอย เครื่องมือสัญญาณรอให้ RSI ต่ำกว่า 70 เพื่อหลีกเลี่ยงการเข้าที่ยอดของการเคลื่อนไหว" },
  faq6q: { en: "Can I get SMS alerts for gold signals?", th: "ฉันรับการแจ้งเตือน SMS สำหรับสัญญาณทองคำได้ไหม?" },
  faq6a: { en: "Yes. Go to your Profile page and find the Notification Preferences panel. Enable SMS alerts, enter your phone number, select XAUUSD (Gold), set your confidence threshold, and save.", th: "ได้ ไปที่หน้าโปรไฟล์และค้นหาแผง การตั้งค่าการแจ้งเตือน เปิดใช้งานการแจ้งเตือน SMS ป้อนหมายเลขโทรศัพท์ของคุณ เลือก XAUUSD (ทองคำ) ตั้งค่าเกณฑ์ความเชื่อมั่น แล้วบันทึก" },
  faq7q: { en: "What is EMA and why does the platform use two of them?", th: "EMA คืออะไร และทำไมแพลตฟอร์มถึงใช้สองตัว?" },
  faq7a: { en: "EMA smooths price over time, weighting recent prices more. Using EMA-8 (fast) and EMA-21 (slow) creates a momentum signal: when the fast EMA crosses above the slow EMA, short-term trend is rising faster than medium-term — a bullish sign.", th: "EMA ทำให้ราคาราบเรียบเมื่อเวลาผ่านไป โดยให้น้ำหนักกับราคาล่าสุดมากขึ้น การใช้ EMA-8 (เร็ว) และ EMA-21 (ช้า) สร้างสัญญาณโมเมนตัม เมื่อ EMA เร็วข้ามขึ้นเหนือ EMA ช้า แนวโน้มระยะสั้นกำลังเพิ่มขึ้นเร็วกว่าระยะกลาง ซึ่งเป็นสัญญาณขาขึ้น" },
  faq8q: { en: "What is the difference between spot price and futures price?", th: "ราคาสปอตและราคาฟิวเจอร์สต่างกันอย่างไร?" },
  faq8a: { en: "Spot price = what you pay for immediate delivery right now. Futures price = what the market expects the price to be at a future date. They usually trade close together but can diverge based on storage costs and supply/demand.", th: "ราคาสปอต = สิ่งที่คุณจ่ายสำหรับการส่งมอบทันที ราคาฟิวเจอร์ส = สิ่งที่ตลาดคาดว่าราคาจะเป็นในวันที่กำหนดในอนาคต โดยปกติจะซื้อขายใกล้เคียงกัน แต่สามารถแตกต่างกันได้ตามต้นทุนการจัดเก็บและอุปสงค์/อุปทาน" },
  faq9q: { en: "Why do gold and oil move together sometimes?", th: "ทำไมทองคำและน้ำมันถึงเคลื่อนไหวไปพร้อมกันบางครั้ง?" },
  faq9a: { en: "Both are priced in US dollars, so when the dollar weakens, commodity prices tend to rise together. However, they can diverge sharply — oil is driven by energy demand and OPEC, while gold is driven by inflation expectations and safe-haven demand.", th: "ทั้งคู่มีราคาในดอลลาร์สหรัฐ ดังนั้นเมื่อดอลลาร์อ่อนค่า ราคาสินค้าโภคภัณฑ์มักเพิ่มขึ้นพร้อมกัน อย่างไรก็ตาม อาจแตกต่างกันอย่างมาก น้ำมันขับเคลื่อนโดยความต้องการพลังงานและโอเปก ในขณะที่ทองคำขับเคลื่อนโดยความคาดหวังเงินเฟ้อและความต้องการสินทรัพย์ปลอดภัย" },

  // ── Alerts setup ──────────────────────────────────────────────────────────
  alertStep1Title: { en: "Go to Profile",                  th: "ไปที่โปรไฟล์" },
  alertStep1Body:  { en: "Click your avatar or name at the bottom of the left sidebar, then select Profile.", th: "คลิกอวตารหรือชื่อของคุณที่ด้านล่างของแถบด้านซ้าย แล้วเลือก โปรไฟล์" },
  alertStep2Title: { en: "Find Notification Preferences",  th: "ค้นหาการตั้งค่าการแจ้งเตือน" },
  alertStep2Body:  { en: "Scroll to the Notification Preferences panel on the right side of the Profile page.", th: "เลื่อนลงไปที่แผงการตั้งค่าการแจ้งเตือนทางด้านขวาของหน้าโปรไฟล์" },
  alertStep3Title: { en: "Enable email and/or SMS",         th: "เปิดใช้งานอีเมลและ/หรือ SMS" },
  alertStep3Body:  { en: "Toggle on Email Alerts and/or SMS Alerts. Enter your email address and phone number in international format (e.g. +66 81 234 5678 for Thailand).", th: "เปิดสวิตช์ การแจ้งเตือนทางอีเมล และ/หรือ การแจ้งเตือน SMS ป้อนที่อยู่อีเมลและหมายเลขโทรศัพท์ในรูปแบบสากล (เช่น +66 81 234 5678 สำหรับไทย)" },
  alertStep4Title: { en: "Select symbols",                  th: "เลือกสัญลักษณ์" },
  alertStep4Body:  { en: "Check the commodities you want to watch — Gold (XAUUSD), Silver (XAGUSD), Oil (USOIL), Bitcoin (BTCUSD), etc.", th: "เลือกสินค้าโภคภัณฑ์ที่คุณต้องการดู — ทองคำ (XAUUSD), เงิน (XAGUSD), น้ำมัน (USOIL), บิตคอยน์ (BTCUSD) ฯลฯ" },
  alertStep5Title: { en: "Set confidence threshold",        th: "ตั้งค่าเกณฑ์ความเชื่อมั่น" },
  alertStep5Body:  { en: "Choose a minimum confidence score (0–100). A threshold of 65 means you only get alerted when the signal engine is fairly confident. Start at 60–70.", th: "เลือกคะแนนความเชื่อมั่นขั้นต่ำ (0–100) เกณฑ์ 65 หมายความว่าคุณจะได้รับการแจ้งเตือนเมื่อเครื่องมือสัญญาณมีความเชื่อมั่นค่อนข้างสูง เริ่มที่ 60–70" },
  alertStep6Title: { en: "Set cooldown",                    th: "ตั้งค่าระยะพัก" },
  alertStep6Body:  { en: "The cooldown (in minutes) prevents repeated alerts for the same symbol. 60 minutes is a good starting point.", th: "ระยะพัก (เป็นนาที) ป้องกันการแจ้งเตือนซ้ำสำหรับสัญลักษณ์เดียวกัน 60 นาทีเป็นจุดเริ่มต้นที่ดี" },
  alertCallout: {
    en: "Alerts fire based on daily OHLCV data fetched every 15 minutes. You will typically receive one alert per symbol per day when conditions align.",
    th: "การแจ้งเตือนเกิดขึ้นตามข้อมูล OHLCV รายวันที่ดึงทุก 15 นาที โดยทั่วไปคุณจะได้รับการแจ้งเตือนหนึ่งครั้งต่อสัญลักษณ์ต่อวันเมื่อเงื่อนไขสอดคล้องกัน",
  },

  // ── Disclaimer ────────────────────────────────────────────────────────────
  disclaimerLabel: { en: "Disclaimer:", th: "ข้อจำกัดความรับผิดชอบ:" },
  disclaimerBody: {
    en: "All signals, scores, and analyses on this platform are for informational and educational purposes only. They do not constitute financial advice. Commodity trading involves substantial risk of loss and is not suitable for all investors. Past performance of signals does not guarantee future results. Always do your own research.",
    th: "สัญญาณ คะแนน และการวิเคราะห์ทั้งหมดบนแพลตฟอร์มนี้มีไว้เพื่อให้ข้อมูลและการศึกษาเท่านั้น ไม่ถือเป็นคำแนะนำทางการเงิน การเทรดสินค้าโภคภัณฑ์มีความเสี่ยงในการสูญเสียอย่างมากและไม่เหมาะสำหรับนักลงทุนทุกคน ผลการดำเนินงานของสัญญาณในอดีตไม่รับประกันผลในอนาคต ควรทำการวิจัยด้วยตนเองเสมอ",
  },
};

export function tr(key: keyof typeof t, lang: Lang): string {
  return t[key]?.[lang] ?? t[key]?.["en"] ?? key;
}
