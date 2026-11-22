// 검수로 고친 뜻: 단어 id → 언어별 뜻 (원본 표를 고치지 않고 이 값으로 덮어씀)
// - 동음이의어: 몽골어·아랍어 뜻은 한국어 글자 하나에 하나라서(tr-mn / tr-ar), 단원마다 뜻이 다른 단어는 여기서 그 단원 뜻으로
// - 표본 검수(라오·태국·베트남·몽골·아랍어)에서 고친 뜻
// 단어 id 는 '<단원 id>-<번호>' (예: t-topik-1-numbers-03, r1-07)
type Native = 'lo' | 'th' | 'vi' | 'mn' | 'ar'

export const FIX: Record<string, Partial<Record<Native, string>>> = {
  'p-kpop-05': { ar: 'هيونغ (أخ أكبر، يقولها الشاب)' },
  'p-school-14': { vi: 'dễ' },
  'p-travel-24': { mn: '24 цагийн дэлгүүр' },
  'p-work-04': { mn: 'захирал, дарга', ar: 'صاحب العمل، المدير' },
  'p-work-12': { lo: 'ເຮັດວຽກລ່ວງເວລາ (ກາງຄືນ)' },
  'r11-10': { lo: 'ສິນລະທຳ' },
  'r11-39': { mn: 'тооцоолол, бодолт', ar: 'حساب، عملية حسابية' },
  'r15-25': { lo: 'ການຍ້າຍຖິ່ນຖານ' },
  'r2-50': { lo: 'ຮຸ້ງກິນນ້ຳ' },
  'r4-15': { mn: '24 цагийн дэлгүүр' },
  'r4-32': { vi: 'đau, ốm' },
  'r4-39': { ar: 'عيد ميلاد' },
  'r8-47': { lo: 'ຕີກັນ · ຖຽງກັນ', th: 'ทะเลาะ · ต่อสู้', mn: 'хэрэлдэх, зодолдох' },
  't-citizen-culture-03': { vi: 'lễ cúng tổ tiên (Tết, Trung thu)', mn: 'баярын өвөг дээдсийн тахилга', ar: 'طقوس تكريم الأجداد في العيد' },
  't-eps-food-shopping-21': { lo: 'ແກ້ວ' },
  't-eps-health-03': { mn: 'хоолой, хүзүү', ar: 'الرقبة، الحلق' },
  't-guide-trouble-26': { ar: 'احملوا حقائبكم أمامكم.' },
  't-hotel-facility-15': { mn: '24 цагийн дэлгүүр' },
  't-hotel-facility-26': { ar: 'يمكنك تناول الفطور في مطعم الطابق الأرضي.' },
  't-hotel-housekeeping-04': { mn: 'Бүү саад бол' },
  't-hotel-room-30': { vi: 'Minibar có tính phí ạ.', ar: 'الميني بار مدفوع.' },
  't-massage-body-30': { th: 'ปวดไหล่ขวาไหม?' },
  't-massage-booking-29': { lo: 'ຈະເອົາຄອດໃດເຈົ້າ?' },
  't-parenting-baby-care-33': { th: 'ช่วยทำน้ำอาบให้อุ่นๆ หน่อย' },
  't-parenting-family-17': { th: 'การกราบอวยพรผู้ใหญ่ในวันปีใหม่', mn: 'шинэ жилийн золголт' },
  't-parenting-school-33': { mn: 'Арай удаан ярьж өгнө үү.' },
  't-parenting-support-01': { lo: 'ສູນຄອບຄົວ', ar: 'مركز دعم الأسرة' },
  't-parenting-support-35': { vi: 'Thứ mấy thì đổ rác phân loại ạ?' },
  't-restaurant-greet-13': { mn: 'хүлээх (дараалал)', ar: 'انتظار (الدور)' },
  't-restaurant-greet-29': { lo: 'ໄດ້ຈອງໂຕະໄວ້ບໍ່ເຈົ້າ?' },
  't-restaurant-order-27': { lo: 'ເອົາເຜັດບໍ່ເຈົ້າ?', vi: 'Quý khách có muốn ăn cay không ạ?' },
  't-store-closing-26': { vi: 'Tôi bắt đầu dọn dẹp để đóng cửa nhé.', ar: 'سأبدأ التنظيف قبل الإغلاق.' },
  't-topik-1-body-22': { ar: 'يُصاب بالحمّى' },
  't-topik-1-family-11': { ar: 'أخت كبرى (تقولها الفتاة)' },
  't-topik-1-food-14': { lo: 'ໝີ່ສຳເລັດຮູບ' },
  't-topik-1-food-15': { th: 'บิบิมบับ (ข้าวยำเกาหลี)' },
  't-topik-1-numbers-11': { mn: 'нэг', ar: 'واحد' },
  't-topik-2-contact-17': { vi: 'sau, lát nữa' },
  't-topik-2-exercise-17': { mn: 'тамхинаас гарах', ar: 'الإقلاع عن التدخين' },
  't-topik-2-feelings-21': { lo: 'ຕື່ນເຕັ້ນລໍຖ້າ' },
  't-topik-2-transport-08': { mn: '(зам) түгжрэх', ar: 'يزدحم (الطريق)' },
  't-topik-2-travel-06': { vi: 'homestay, nhà dân' },
  't-topik-2-work-11': { th: 'การเดินทางเพื่อธุรกิจ' },
  't-topik-3-abstract-words-14': { ar: 'يرضى، يشعر بالرضا' },
  't-topik-4-arts-10': { lo: 'ອອກສາຍ (ຮູບເງົາ)' },
  't-topik-4-idioms-29': { mn: 'Маргааш шалгалттай болохоор цаг тулчихлаа.' },
  't-topik-5-diplomacy-21': { mn: 'зэвсэглэл хорогдуулах' },
  't-topik-5-history-29': { lo: 'ນັກປາດສາຍຊິລຮັກເນັ້ນວິຊາທີ່ໃຊ້ໄດ້ຈິງ' },
  't-topik-5-media-consumer-06': { th: 'การบิดเบือนมติมหาชน' },
  't-topik-5-science-08': { vi: 'tính tái lập' },
  't-topik-6-adverbs-connectives-30': { vi: 'Chưa nói đến chi phí, thời gian cũng đã không đủ.' },
  't-topik-6-four-char-idioms-13': { ar: 'ترابط المصير (الشفاه والأسنان)' },
  't-topik-6-four-char-idioms-30': { th: 'มีคำกล่าวว่าชีวิตคนเรามีขึ้นมีลง ร้ายอาจกลายเป็นดี' },
  't-topik-6-idioms-15': { th: 'ทวีความรุนแรง (อากาศ โรค)' },
  't-work-injury-27': { vi: 'Tôi bị cắt vào ngón tay, chảy máu rồi.' },
  't-work-tools-21': { lo: 'ເສຍ (ເຄື່ອງເສຍ)' },
}

/** 검수로 고친 뜻 덮어쓰기 */
export function withFix<T extends { id: string }>(w: T): T {
  const f = FIX[w.id]
  return f ? { ...w, ...f } : w
}
