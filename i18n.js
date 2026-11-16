// Languages and translations for the whole shop. Loaded before app.js (and on the thank-you page).
// Product names stay as they are (they are brand names); descriptions and every other text are translated.
(() => {
  const KEY = "laniko-lang";

  const LANGS = [
    { code: "en", name: "English", dir: "ltr", locale: "en-LU", short: "EN" },
    { code: "de", name: "Deutsch", dir: "ltr", locale: "de-DE", short: "DE" },
    { code: "fr", name: "Français", dir: "ltr", locale: "fr-FR", short: "FR" },
    { code: "pt", name: "Português", dir: "ltr", locale: "pt-PT", short: "PT" },
    { code: "it", name: "Italiano", dir: "ltr", locale: "it-IT", short: "IT" },
    { code: "es", name: "Español", dir: "ltr", locale: "es-ES", short: "ES" },
    { code: "ar", name: "العربية", dir: "rtl", locale: "ar-u-nu-latn", short: "AR" },
    { code: "zh", name: "中文", dir: "ltr", locale: "zh-CN", short: "中文" },
  ];

  const S = {
    en: {
      title: "Laniko | Extrait de Parfum",
      metaDesc: "Laniko extraits de parfum, 50 ml. Discover the collection, our top sellers, and save your favourites.",
      brandAria: "Laniko, home", cart: "Cart", openCart: "Open cart", closeCart: "Close cart", yourCart: "Your cart",
      subtotal: "Subtotal", shipNote: "Shipping is calculated at checkout.", checkout: "Checkout", redirecting: "Redirecting…",
      cartEmpty: "Your cart is empty.", less: "Less", more: "More", removeItem: "Remove from cart",
      perfumes: "Perfumes", topSellers: "Top sellers", wishlist: "Wishlist", pagesAria: "Pages",
      collectionTitle: "The Collection", collectionSub: "Extrait de Parfum · 50 ml",
      topTitle: "Top sellers", topSub: "The fragrances our customers come back for.",
      wishTitle: "Your wishlist", wishSub: "Saved on this device.",
      emptyPerfumes: "No perfumes to show yet.", emptyTop: "Our top sellers will appear here soon.",
      emptyWish: "Nothing saved yet. Tap the heart on any perfume to keep it here.", browse: "Browse the collection",
      loading: "Loading…", loadFail: "Could not load products.",
      view3d: "View {name} in 3D", saveWish: "Save {name} to wishlist",
      removedWish: "Removed from wishlist", savedWish: "Saved to wishlist",
      viewerHint: "Drag to rotate · pinch to zoom · two fingers to move", viewerFail: "3D view isn't available on this device.",
      add: "Add to cart", close3d: "Close 3D view", view3dLabel: "3D view",
      canceled: "Checkout canceled. Your cart is still here.", checkoutFail: "Something went wrong. Please try again.",
      footer: "© Laniko · Extrait de Parfum",
      langBtnAria: "Change language", chooseLang: "Choose your language", chooseSub: "You can change it at any time.", closeLang: "Close",
      thanksDoc: "Thank you | Laniko", thanksTitle: "Thank you for your order!",
      thanksBody: "Your payment went through. A receipt is on its way to your email.", back: "Back to the shop",
      promoNew: "New · Extrait de Parfum", promoTag: "A dream that contradicts itself.",
      promoBody: "Sparkling red grapefruit meets velvety rose and a thread of saffron: fresh and dark at once.",
      promoNotes: ["Red grapefruit", "Velvet rose", "Saffron"], promoMeta: "50 ml · Extrait de Parfum",
      promoCta: "Discover the fragrance", promoLater: "Maybe later", promoClose: "Close", promoAria: "New fragrance: Rêve Paradoxé",
    },
    de: {
      title: "Laniko | Extrait de Parfum",
      metaDesc: "Laniko Extraits de Parfum, 50 ml. Entdecken Sie die Kollektion, unsere Bestseller und speichern Sie Ihre Favoriten.",
      brandAria: "Laniko, Startseite", cart: "Warenkorb", openCart: "Warenkorb öffnen", closeCart: "Warenkorb schließen", yourCart: "Ihr Warenkorb",
      subtotal: "Zwischensumme", shipNote: "Der Versand wird an der Kasse berechnet.", checkout: "Zur Kasse", redirecting: "Weiterleitung…",
      cartEmpty: "Ihr Warenkorb ist leer.", less: "Weniger", more: "Mehr", removeItem: "Aus dem Warenkorb entfernen",
      perfumes: "Parfums", topSellers: "Bestseller", wishlist: "Wunschliste", pagesAria: "Seiten",
      collectionTitle: "Die Kollektion", collectionSub: "Extrait de Parfum · 50 ml",
      topTitle: "Bestseller", topSub: "Die Düfte, für die unsere Kunden immer wiederkommen.",
      wishTitle: "Ihre Wunschliste", wishSub: "Auf diesem Gerät gespeichert.",
      emptyPerfumes: "Noch keine Parfums vorhanden.", emptyTop: "Unsere Bestseller erscheinen bald hier.",
      emptyWish: "Noch nichts gespeichert. Tippen Sie bei einem Parfum auf das Herz, um es hier zu merken.", browse: "Zur Kollektion",
      loading: "Wird geladen…", loadFail: "Produkte konnten nicht geladen werden.",
      view3d: "{name} in 3D ansehen", saveWish: "{name} zur Wunschliste hinzufügen",
      removedWish: "Von der Wunschliste entfernt", savedWish: "Zur Wunschliste hinzugefügt",
      viewerHint: "Ziehen zum Drehen · Zusammenziehen zum Zoomen · zwei Finger zum Verschieben", viewerFail: "Die 3D-Ansicht ist auf diesem Gerät nicht verfügbar.",
      add: "In den Warenkorb", close3d: "3D-Ansicht schließen", view3dLabel: "3D-Ansicht",
      canceled: "Bezahlvorgang abgebrochen. Ihr Warenkorb ist noch da.", checkoutFail: "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.",
      footer: "© Laniko · Extrait de Parfum",
      langBtnAria: "Sprache ändern", chooseLang: "Wählen Sie Ihre Sprache", chooseSub: "Sie können sie jederzeit ändern.", closeLang: "Schließen",
      thanksDoc: "Vielen Dank | Laniko", thanksTitle: "Vielen Dank für Ihre Bestellung!",
      thanksBody: "Ihre Zahlung wurde durchgeführt. Eine Quittung ist unterwegs an Ihre E-Mail-Adresse.", back: "Zurück zum Shop",
      promoNew: "Neu · Extrait de Parfum", promoTag: "Ein Traum, der sich selbst widerspricht.",
      promoBody: "Funkelnde rote Grapefruit trifft auf samtige Rose und einen Hauch Safran: frisch und dunkel zugleich.",
      promoNotes: ["Rote Grapefruit", "Samtrose", "Safran"], promoMeta: "50 ml · Extrait de Parfum",
      promoCta: "Den Duft entdecken", promoLater: "Vielleicht später", promoClose: "Schließen", promoAria: "Neuer Duft: Rêve Paradoxé",
    },
    fr: {
      title: "Laniko | Extrait de Parfum",
      metaDesc: "Extraits de parfum Laniko, 50 ml. Découvrez la collection, nos best-sellers et enregistrez vos favoris.",
      brandAria: "Laniko, accueil", cart: "Panier", openCart: "Ouvrir le panier", closeCart: "Fermer le panier", yourCart: "Votre panier",
      subtotal: "Sous-total", shipNote: "Les frais de livraison sont calculés lors du paiement.", checkout: "Commander", redirecting: "Redirection…",
      cartEmpty: "Votre panier est vide.", less: "Moins", more: "Plus", removeItem: "Retirer du panier",
      perfumes: "Parfums", topSellers: "Best-sellers", wishlist: "Favoris", pagesAria: "Pages",
      collectionTitle: "La Collection", collectionSub: "Extrait de Parfum · 50 ml",
      topTitle: "Best-sellers", topSub: "Les parfums vers lesquels nos clients reviennent.",
      wishTitle: "Vos favoris", wishSub: "Enregistrés sur cet appareil.",
      emptyPerfumes: "Aucun parfum à afficher pour le moment.", emptyTop: "Nos best-sellers apparaîtront bientôt ici.",
      emptyWish: "Rien d'enregistré pour l'instant. Touchez le cœur sur un parfum pour le garder ici.", browse: "Parcourir la collection",
      loading: "Chargement…", loadFail: "Impossible de charger les produits.",
      view3d: "Voir {name} en 3D", saveWish: "Ajouter {name} aux favoris",
      removedWish: "Retiré des favoris", savedWish: "Ajouté aux favoris",
      viewerHint: "Faites glisser pour tourner · pincez pour zoomer · deux doigts pour déplacer", viewerFail: "La vue 3D n'est pas disponible sur cet appareil.",
      add: "Ajouter au panier", close3d: "Fermer la vue 3D", view3dLabel: "Vue 3D",
      canceled: "Paiement annulé. Votre panier est toujours là.", checkoutFail: "Une erreur s'est produite. Veuillez réessayer.",
      footer: "© Laniko · Extrait de Parfum",
      langBtnAria: "Changer de langue", chooseLang: "Choisissez votre langue", chooseSub: "Vous pouvez la modifier à tout moment.", closeLang: "Fermer",
      thanksDoc: "Merci | Laniko", thanksTitle: "Merci pour votre commande !",
      thanksBody: "Votre paiement a bien été effectué. Un reçu vous est envoyé par e-mail.", back: "Retour à la boutique",
      promoNew: "Nouveau · Extrait de Parfum", promoTag: "Un rêve qui se contredit lui-même.",
      promoBody: "Pamplemousse rouge pétillant, rose veloutée et un fil de safran : à la fois frais et sombre.",
      promoNotes: ["Pamplemousse rouge", "Rose veloutée", "Safran"], promoMeta: "50 ml · Extrait de Parfum",
      promoCta: "Découvrir le parfum", promoLater: "Plus tard", promoClose: "Fermer", promoAria: "Nouveau parfum : Rêve Paradoxé",
    },
    pt: {
      title: "Laniko | Extrait de Parfum",
      metaDesc: "Extraits de parfum Laniko, 50 ml. Descubra a coleção, os nossos mais vendidos e guarde os seus favoritos.",
      brandAria: "Laniko, início", cart: "Carrinho", openCart: "Abrir carrinho", closeCart: "Fechar carrinho", yourCart: "O seu carrinho",
      subtotal: "Subtotal", shipNote: "Os portes de envio são calculados no pagamento.", checkout: "Finalizar compra", redirecting: "A redirecionar…",
      cartEmpty: "O seu carrinho está vazio.", less: "Menos", more: "Mais", removeItem: "Remover do carrinho",
      perfumes: "Perfumes", topSellers: "Mais vendidos", wishlist: "Favoritos", pagesAria: "Páginas",
      collectionTitle: "A Coleção", collectionSub: "Extrait de Parfum · 50 ml",
      topTitle: "Mais vendidos", topSub: "As fragrâncias a que os nossos clientes voltam sempre.",
      wishTitle: "Os seus favoritos", wishSub: "Guardados neste dispositivo.",
      emptyPerfumes: "Ainda não há perfumes para mostrar.", emptyTop: "Os nossos mais vendidos aparecerão aqui em breve.",
      emptyWish: "Ainda nada guardado. Toque no coração de qualquer perfume para o guardar aqui.", browse: "Ver a coleção",
      loading: "A carregar…", loadFail: "Não foi possível carregar os produtos.",
      view3d: "Ver {name} em 3D", saveWish: "Guardar {name} nos favoritos",
      removedWish: "Removido dos favoritos", savedWish: "Guardado nos favoritos",
      viewerHint: "Arraste para rodar · junte os dedos para ampliar · dois dedos para mover", viewerFail: "A vista 3D não está disponível neste dispositivo.",
      add: "Adicionar ao carrinho", close3d: "Fechar vista 3D", view3dLabel: "Vista 3D",
      canceled: "Pagamento cancelado. O seu carrinho continua aqui.", checkoutFail: "Algo correu mal. Tente novamente.",
      footer: "© Laniko · Extrait de Parfum",
      langBtnAria: "Alterar idioma", chooseLang: "Escolha o seu idioma", chooseSub: "Pode alterá-lo a qualquer momento.", closeLang: "Fechar",
      thanksDoc: "Obrigado | Laniko", thanksTitle: "Obrigado pela sua encomenda!",
      thanksBody: "O seu pagamento foi efetuado. Um recibo está a caminho do seu e-mail.", back: "Voltar à loja",
      promoNew: "Novo · Extrait de Parfum", promoTag: "Um sonho que se contradiz.",
      promoBody: "Toranja vermelha cintilante, rosa aveludada e um fio de açafrão: fresco e sombrio ao mesmo tempo.",
      promoNotes: ["Toranja vermelha", "Rosa aveludada", "Açafrão"], promoMeta: "50 ml · Extrait de Parfum",
      promoCta: "Descobrir a fragrância", promoLater: "Talvez mais tarde", promoClose: "Fechar", promoAria: "Nova fragrância: Rêve Paradoxé",
    },
    it: {
      title: "Laniko | Extrait de Parfum",
      metaDesc: "Extraits de parfum Laniko, 50 ml. Scopri la collezione, i nostri più venduti e salva i tuoi preferiti.",
      brandAria: "Laniko, home", cart: "Carrello", openCart: "Apri il carrello", closeCart: "Chiudi il carrello", yourCart: "Il tuo carrello",
      subtotal: "Subtotale", shipNote: "La spedizione viene calcolata al momento del pagamento.", checkout: "Procedi al pagamento", redirecting: "Reindirizzamento…",
      cartEmpty: "Il tuo carrello è vuoto.", less: "Meno", more: "Più", removeItem: "Rimuovi dal carrello",
      perfumes: "Profumi", topSellers: "Più venduti", wishlist: "Preferiti", pagesAria: "Pagine",
      collectionTitle: "La Collezione", collectionSub: "Extrait de Parfum · 50 ml",
      topTitle: "Più venduti", topSub: "Le fragranze a cui i nostri clienti tornano sempre.",
      wishTitle: "I tuoi preferiti", wishSub: "Salvati su questo dispositivo.",
      emptyPerfumes: "Nessun profumo da mostrare per ora.", emptyTop: "I nostri più venduti appariranno presto qui.",
      emptyWish: "Ancora nulla di salvato. Tocca il cuore su un profumo per tenerlo qui.", browse: "Sfoglia la collezione",
      loading: "Caricamento…", loadFail: "Impossibile caricare i prodotti.",
      view3d: "Vedi {name} in 3D", saveWish: "Salva {name} nei preferiti",
      removedWish: "Rimosso dai preferiti", savedWish: "Salvato nei preferiti",
      viewerHint: "Trascina per ruotare · pizzica per ingrandire · due dita per spostare", viewerFail: "La vista 3D non è disponibile su questo dispositivo.",
      add: "Aggiungi al carrello", close3d: "Chiudi la vista 3D", view3dLabel: "Vista 3D",
      canceled: "Pagamento annullato. Il tuo carrello è ancora qui.", checkoutFail: "Qualcosa è andato storto. Riprova.",
      footer: "© Laniko · Extrait de Parfum",
      langBtnAria: "Cambia lingua", chooseLang: "Scegli la tua lingua", chooseSub: "Puoi cambiarla in qualsiasi momento.", closeLang: "Chiudi",
      thanksDoc: "Grazie | Laniko", thanksTitle: "Grazie per il tuo ordine!",
      thanksBody: "Il pagamento è andato a buon fine. Una ricevuta è in arrivo alla tua e-mail.", back: "Torna al negozio",
      promoNew: "Novità · Extrait de Parfum", promoTag: "Un sogno che contraddice se stesso.",
      promoBody: "Pompelmo rosso frizzante, rosa vellutata e un filo di zafferano: fresco e scuro allo stesso tempo.",
      promoNotes: ["Pompelmo rosso", "Rosa vellutata", "Zafferano"], promoMeta: "50 ml · Extrait de Parfum",
      promoCta: "Scopri la fragranza", promoLater: "Forse più tardi", promoClose: "Chiudi", promoAria: "Nuova fragranza: Rêve Paradoxé",
    },
    es: {
      title: "Laniko | Extrait de Parfum",
      metaDesc: "Extraits de parfum Laniko, 50 ml. Descubre la colección, nuestros más vendidos y guarda tus favoritos.",
      brandAria: "Laniko, inicio", cart: "Carrito", openCart: "Abrir carrito", closeCart: "Cerrar carrito", yourCart: "Tu carrito",
      subtotal: "Subtotal", shipNote: "El envío se calcula al finalizar la compra.", checkout: "Finalizar compra", redirecting: "Redirigiendo…",
      cartEmpty: "Tu carrito está vacío.", less: "Menos", more: "Más", removeItem: "Quitar del carrito",
      perfumes: "Perfumes", topSellers: "Más vendidos", wishlist: "Favoritos", pagesAria: "Páginas",
      collectionTitle: "La Colección", collectionSub: "Extrait de Parfum · 50 ml",
      topTitle: "Más vendidos", topSub: "Las fragancias a las que nuestros clientes siempre vuelven.",
      wishTitle: "Tus favoritos", wishSub: "Guardados en este dispositivo.",
      emptyPerfumes: "Aún no hay perfumes que mostrar.", emptyTop: "Nuestros más vendidos aparecerán aquí pronto.",
      emptyWish: "Aún no has guardado nada. Toca el corazón de cualquier perfume para guardarlo aquí.", browse: "Ver la colección",
      loading: "Cargando…", loadFail: "No se pudieron cargar los productos.",
      view3d: "Ver {name} en 3D", saveWish: "Guardar {name} en favoritos",
      removedWish: "Eliminado de favoritos", savedWish: "Guardado en favoritos",
      viewerHint: "Arrastra para girar · pellizca para ampliar · dos dedos para mover", viewerFail: "La vista 3D no está disponible en este dispositivo.",
      add: "Añadir al carrito", close3d: "Cerrar vista 3D", view3dLabel: "Vista 3D",
      canceled: "Pago cancelado. Tu carrito sigue aquí.", checkoutFail: "Algo salió mal. Inténtalo de nuevo.",
      footer: "© Laniko · Extrait de Parfum",
      langBtnAria: "Cambiar idioma", chooseLang: "Elige tu idioma", chooseSub: "Puedes cambiarlo en cualquier momento.", closeLang: "Cerrar",
      thanksDoc: "Gracias | Laniko", thanksTitle: "¡Gracias por tu pedido!",
      thanksBody: "Tu pago se ha realizado. Te enviamos un recibo a tu correo electrónico.", back: "Volver a la tienda",
      promoNew: "Novedad · Extrait de Parfum", promoTag: "Un sueño que se contradice a sí mismo.",
      promoBody: "Pomelo rojo burbujeante, rosa aterciopelada y un hilo de azafrán: fresco y oscuro a la vez.",
      promoNotes: ["Pomelo rojo", "Rosa aterciopelada", "Azafrán"], promoMeta: "50 ml · Extrait de Parfum",
      promoCta: "Descubre la fragancia", promoLater: "Quizás más tarde", promoClose: "Cerrar", promoAria: "Nueva fragancia: Rêve Paradoxé",
    },
    ar: {
      title: "لانيكو | إكستريت دو بارفان",
      metaDesc: "عطور لانيكو إكستريت دو بارفان، 50 مل. اكتشف المجموعة والأكثر مبيعًا واحفظ مفضلاتك.",
      brandAria: "لانيكو، الصفحة الرئيسية", cart: "السلة", openCart: "فتح السلة", closeCart: "إغلاق السلة", yourCart: "سلتك",
      subtotal: "المجموع الفرعي", shipNote: "يُحسب الشحن عند إتمام الشراء.", checkout: "إتمام الشراء", redirecting: "جارٍ التحويل…",
      cartEmpty: "سلتك فارغة.", less: "أقل", more: "أكثر", removeItem: "إزالة من السلة",
      perfumes: "العطور", topSellers: "الأكثر مبيعًا", wishlist: "المفضلة", pagesAria: "الصفحات",
      collectionTitle: "المجموعة", collectionSub: "إكستريت دو بارفان · 50 مل",
      topTitle: "الأكثر مبيعًا", topSub: "العطور التي يعود إليها عملاؤنا دائمًا.",
      wishTitle: "مفضلتك", wishSub: "محفوظة على هذا الجهاز.",
      emptyPerfumes: "لا توجد عطور لعرضها بعد.", emptyTop: "ستظهر هنا قريبًا العطور الأكثر مبيعًا.",
      emptyWish: "لم تحفظ شيئًا بعد. اضغط على القلب في أي عطر لحفظه هنا.", browse: "تصفّح المجموعة",
      loading: "جارٍ التحميل…", loadFail: "تعذّر تحميل المنتجات.",
      view3d: "عرض {name} ثلاثي الأبعاد", saveWish: "حفظ {name} في المفضلة",
      removedWish: "تمت الإزالة من المفضلة", savedWish: "تم الحفظ في المفضلة",
      viewerHint: "اسحب للتدوير · اضغط بإصبعين للتكبير · اسحب بإصبعين للتحريك", viewerFail: "العرض ثلاثي الأبعاد غير متاح على هذا الجهاز.",
      add: "أضف إلى السلة", close3d: "إغلاق العرض ثلاثي الأبعاد", view3dLabel: "عرض ثلاثي الأبعاد",
      canceled: "تم إلغاء الدفع. سلتك ما زالت هنا.", checkoutFail: "حدث خطأ ما. يرجى المحاولة مرة أخرى.",
      footer: "© لانيكو · إكستريت دو بارفان",
      langBtnAria: "تغيير اللغة", chooseLang: "اختر لغتك", chooseSub: "يمكنك تغييرها في أي وقت.", closeLang: "إغلاق",
      thanksDoc: "شكرًا | لانيكو", thanksTitle: "شكرًا لطلبك!",
      thanksBody: "تمت عملية الدفع بنجاح. إيصالك في طريقه إلى بريدك الإلكتروني.", back: "العودة إلى المتجر",
      promoNew: "جديد · إكستريت دو بارفان", promoTag: "حلمٌ يناقض نفسه.",
      promoBody: "جريب فروت أحمر متلألئ يلتقي بوردة مخملية وخيط من الزعفران: منعش وداكن في آنٍ واحد.",
      promoNotes: ["جريب فروت أحمر", "ورد مخملي", "زعفران"], promoMeta: "50 مل · إكستريت دو بارفان",
      promoCta: "اكتشف العطر", promoLater: "ربما لاحقًا", promoClose: "إغلاق", promoAria: "عطر جديد: Rêve Paradoxé",
    },
    zh: {
      title: "Laniko | 浓香精 Extrait de Parfum",
      metaDesc: "Laniko 浓香精（Extrait de Parfum）50 毫升。探索系列、热销之选，并收藏您的最爱。",
      brandAria: "Laniko，首页", cart: "购物车", openCart: "打开购物车", closeCart: "关闭购物车", yourCart: "您的购物车",
      subtotal: "小计", shipNote: "运费将在结账时计算。", checkout: "去结账", redirecting: "正在跳转…",
      cartEmpty: "您的购物车是空的。", less: "减少", more: "增加", removeItem: "从购物车移除",
      perfumes: "香水", topSellers: "热销榜", wishlist: "心愿单", pagesAria: "页面",
      collectionTitle: "系列", collectionSub: "Extrait de Parfum · 50 毫升",
      topTitle: "热销榜", topSub: "顾客一再回购的香氛。",
      wishTitle: "您的心愿单", wishSub: "保存在此设备上。",
      emptyPerfumes: "暂无香水可显示。", emptyTop: "热销香水即将在此呈现。",
      emptyWish: "还没有收藏。点击任意香水上的爱心即可保存在这里。", browse: "浏览系列",
      loading: "加载中…", loadFail: "无法加载商品。",
      view3d: "以 3D 查看 {name}", saveWish: "将 {name} 加入心愿单",
      removedWish: "已从心愿单移除", savedWish: "已加入心愿单",
      viewerHint: "拖动旋转 · 双指捏合缩放 · 双指拖动平移", viewerFail: "此设备不支持 3D 视图。",
      add: "加入购物车", close3d: "关闭 3D 视图", view3dLabel: "3D 视图",
      canceled: "结账已取消。您的购物车仍然保留。", checkoutFail: "出了点问题，请重试。",
      footer: "© Laniko · Extrait de Parfum",
      langBtnAria: "更改语言", chooseLang: "请选择语言", chooseSub: "您可以随时更改。", closeLang: "关闭",
      thanksDoc: "谢谢 | Laniko", thanksTitle: "感谢您的订单！",
      thanksBody: "付款已完成。收据正发送至您的邮箱。", back: "返回商店",
      promoNew: "新品 · Extrait de Parfum", promoTag: "一场自相矛盾的梦。",
      promoBody: "闪耀的红西柚邂逅丝绒玫瑰与一缕藏红花：清新与深邃并存。",
      promoNotes: ["红西柚", "丝绒玫瑰", "藏红花"], promoMeta: "50 毫升 · Extrait de Parfum",
      promoCta: "探索这款香氛", promoLater: "稍后再说", promoClose: "关闭", promoAria: "新品香氛：Rêve Paradoxé",
    },
  };


  // product page
  const P = {
    en: { pdBack: "Back", pdScroll: "Scroll to discover", pdTap: "Tap the bottle to view it in 3D", pdAbout: "The fragrance", pdNotes: "Key notes", pdDetails: "Details", pdConc: "Concentration", pdConcVal: "Extrait de Parfum", pdSize: "Size", pdSizeVal: "50 ml", pdShip: "Shipping", pdShipVal: "Flat rate {price} · LU, BE, FR, DE, NL", pdPay: "Payment", pdPayVal: "Secure checkout with Stripe" },
    de: { pdBack: "Zurück", pdScroll: "Scrollen zum Entdecken", pdTap: "Auf die Flasche tippen für die 3D-Ansicht", pdAbout: "Der Duft", pdNotes: "Duftnoten", pdDetails: "Details", pdConc: "Konzentration", pdConcVal: "Extrait de Parfum", pdSize: "Größe", pdSizeVal: "50 ml", pdShip: "Versand", pdShipVal: "Pauschal {price} · LU, BE, FR, DE, NL", pdPay: "Zahlung", pdPayVal: "Sichere Bezahlung über Stripe" },
    fr: { pdBack: "Retour", pdScroll: "Faites défiler pour découvrir", pdTap: "Touchez le flacon pour le voir en 3D", pdAbout: "Le parfum", pdNotes: "Notes principales", pdDetails: "Détails", pdConc: "Concentration", pdConcVal: "Extrait de Parfum", pdSize: "Contenance", pdSizeVal: "50 ml", pdShip: "Livraison", pdShipVal: "Forfait {price} · LU, BE, FR, DE, NL", pdPay: "Paiement", pdPayVal: "Paiement sécurisé avec Stripe" },
    pt: { pdBack: "Voltar", pdScroll: "Deslize para descobrir", pdTap: "Toque no frasco para ver em 3D", pdAbout: "A fragrância", pdNotes: "Notas principais", pdDetails: "Detalhes", pdConc: "Concentração", pdConcVal: "Extrait de Parfum", pdSize: "Tamanho", pdSizeVal: "50 ml", pdShip: "Envio", pdShipVal: "Taxa fixa {price} · LU, BE, FR, DE, NL", pdPay: "Pagamento", pdPayVal: "Pagamento seguro com Stripe" },
    it: { pdBack: "Indietro", pdScroll: "Scorri per scoprire", pdTap: "Tocca il flacone per vederlo in 3D", pdAbout: "La fragranza", pdNotes: "Note principali", pdDetails: "Dettagli", pdConc: "Concentrazione", pdConcVal: "Extrait de Parfum", pdSize: "Formato", pdSizeVal: "50 ml", pdShip: "Spedizione", pdShipVal: "Tariffa fissa {price} · LU, BE, FR, DE, NL", pdPay: "Pagamento", pdPayVal: "Pagamento sicuro con Stripe" },
    es: { pdBack: "Volver", pdScroll: "Desliza para descubrir", pdTap: "Toca el frasco para verlo en 3D", pdAbout: "La fragancia", pdNotes: "Notas principales", pdDetails: "Detalles", pdConc: "Concentración", pdConcVal: "Extrait de Parfum", pdSize: "Tamaño", pdSizeVal: "50 ml", pdShip: "Envío", pdShipVal: "Tarifa plana {price} · LU, BE, FR, DE, NL", pdPay: "Pago", pdPayVal: "Pago seguro con Stripe" },
    ar: { pdBack: "رجوع", pdScroll: "مرّر للاستكشاف", pdTap: "اضغط على الزجاجة لعرضها ثلاثية الأبعاد", pdAbout: "العطر", pdNotes: "النوتات الرئيسية", pdDetails: "التفاصيل", pdConc: "التركيز", pdConcVal: "إكستريت دو بارفان", pdSize: "الحجم", pdSizeVal: "50 مل", pdShip: "الشحن", pdShipVal: "سعر ثابت {price} · LU, BE, FR, DE, NL", pdPay: "الدفع", pdPayVal: "دفع آمن عبر Stripe" },
    zh: { pdBack: "返回", pdScroll: "向下滚动探索", pdTap: "点按瓶身以 3D 查看", pdAbout: "香氛", pdNotes: "主要香调", pdDetails: "详情", pdConc: "浓度", pdConcVal: "Extrait de Parfum 浓香精", pdSize: "容量", pdSizeVal: "50 毫升", pdShip: "配送", pdShipVal: "统一运费 {price} · LU, BE, FR, DE, NL", pdPay: "支付", pdPayVal: "通过 Stripe 安全支付" },
  };
  Object.keys(P).forEach((c) => Object.assign(S[c], P[c]));

  // scent notes (the English words are the keys used in products.json)
  const NOTES = {
    "white rose": ["Weiße Rose", "Rose blanche", "Rosa branca", "Rosa bianca", "Rosa blanca", "وردة بيضاء", "白玫瑰"],
    "orchid": ["Orchidee", "Orchidée", "Orquídea", "Orchidea", "Orquídea", "أوركيد", "兰花"],
    "Bourbon vanilla": ["Bourbon-Vanille", "Vanille Bourbon", "Baunilha Bourbon", "Vaniglia Bourbon", "Vainilla Bourbon", "فانيلا بوربون", "波本香草"],
    "golden resin": ["Goldenes Harz", "Résine dorée", "Resina dourada", "Resina dorata", "Resina dorada", "راتنج ذهبي", "金色树脂"],
    "red grapefruit": ["Rote Grapefruit", "Pamplemousse rouge", "Toranja vermelha", "Pompelmo rosso", "Pomelo rojo", "جريب فروت أحمر", "红西柚"],
    "velvet rose": ["Samtrose", "Rose veloutée", "Rosa aveludada", "Rosa vellutata", "Rosa aterciopelada", "ورد مخملي", "丝绒玫瑰"],
    "saffron": ["Safran", "Safran", "Açafrão", "Zafferano", "Azafrán", "زعفران", "藏红花"],
    "smoked sandalwood": ["Geräuchertes Sandelholz", "Bois de santal fumé", "Sândalo defumado", "Sandalo affumicato", "Sándalo ahumado", "خشب صندل مدخّن", "烟熏檀香"],
    "black pepper": ["Schwarzer Pfeffer", "Poivre noir", "Pimenta-preta", "Pepe nero", "Pimienta negra", "فلفل أسود", "黑胡椒"],
    "dark vanilla": ["Dunkle Vanille", "Vanille sombre", "Baunilha escura", "Vaniglia scura", "Vainilla oscura", "فانيلا داكنة", "深邃香草"],
    "amber": ["Amber", "Ambre", "Âmbar", "Ambra", "Ámbar", "عنبر", "琥珀"],
    "crimson rose": ["Purpurrote Rose", "Rose cramoisie", "Rosa carmesim", "Rosa cremisi", "Rosa carmesí", "وردة قرمزية", "绯红玫瑰"],
    "ripe raspberry": ["Reife Himbeere", "Framboise mûre", "Framboesa madura", "Lampone maturo", "Frambuesa madura", "توت العليق الناضج", "熟透覆盆子"],
    "precious woods": ["Edle Hölzer", "Bois précieux", "Madeiras preciosas", "Legni preziosi", "Maderas preciosas", "خشب نفيس", "珍贵木质调"],
    "lavender": ["Lavendel", "Lavande", "Lavanda", "Lavanda", "Lavanda", "خزامى", "薰衣草"],
    "white jasmine": ["Weißer Jasmin", "Jasmin blanc", "Jasmim branco", "Gelsomino bianco", "Jazmín blanco", "ياسمين أبيض", "白茉莉"],
    "dark berries": ["Dunkle Beeren", "Baies sombres", "Frutos silvestres escuros", "Bacche scure", "Bayas oscuras", "توت داكن", "黑莓"],
    "smooth wood": ["Sanftes Holz", "Bois doux", "Madeira suave", "Legno morbido", "Madera suave", "خشب ناعم", "柔和木质调"],
  };
  const NOTE_ORDER = ["de", "fr", "pt", "it", "es", "ar", "zh"];
  const noteName = (key) => {
    if (cur === "en") return key[0].toUpperCase() + key.slice(1);
    const row = NOTES[key]; const i = NOTE_ORDER.indexOf(cur);
    return (row && i >= 0 && row[i]) || key;
  };

  // product descriptions (the names are brand names and are never translated)
  const D = {
    "blanc-royal": {
      en: "Creamy white rose and orchid resting on warm Bourbon vanilla and golden resin. Soft, luminous and quietly regal.",
      de: "Cremige weiße Rose und Orchidee, gebettet auf warme Bourbon-Vanille und goldenes Harz. Sanft, leuchtend und still majestätisch.",
      fr: "Rose blanche crémeuse et orchidée reposant sur une vanille Bourbon chaleureuse et une résine dorée. Douce, lumineuse et discrètement royale.",
      pt: "Rosa branca cremosa e orquídea sobre baunilha Bourbon quente e resina dourada. Suave, luminosa e discretamente majestosa.",
      it: "Rosa bianca cremosa e orchidea adagiate su calda vaniglia Bourbon e resina dorata. Morbida, luminosa e silenziosamente regale.",
      es: "Rosa blanca cremosa y orquídea sobre cálida vainilla Bourbon y resina dorada. Suave, luminosa y discretamente regia.",
      ar: "وردة بيضاء كريمية وأوركيد تستقران على فانيلا بوربون الدافئة وراتنج ذهبي. ناعم، مشعّ، وأنيق بوقار هادئ.",
      zh: "奶油般柔滑的白玫瑰与兰花，栖于温暖的波本香草与金色树脂之上。柔和、明亮，静谧而尊贵。",
    },
    "reve-paradoxe": {
      en: "Sparkling red grapefruit meets velvety rose and a thread of saffron. Fresh and dark at once, a dream that contradicts itself.",
      de: "Funkelnde rote Grapefruit trifft auf samtige Rose und einen Hauch Safran. Frisch und dunkel zugleich – ein Traum, der sich selbst widerspricht.",
      fr: "Pamplemousse rouge pétillant, rose veloutée et un fil de safran. À la fois frais et sombre, un rêve qui se contredit lui-même.",
      pt: "Toranja vermelha cintilante encontra rosa aveludada e um fio de açafrão. Fresco e sombrio ao mesmo tempo, um sonho que se contradiz.",
      it: "Pompelmo rosso frizzante incontra una rosa vellutata e un filo di zafferano. Fresco e scuro allo stesso tempo, un sogno che contraddice se stesso.",
      es: "Pomelo rojo burbujeante con rosa aterciopelada y un hilo de azafrán. Fresco y oscuro a la vez, un sueño que se contradice a sí mismo.",
      ar: "جريب فروت أحمر متلألئ يلتقي بوردة مخملية وخيط من الزعفران. منعش وداكن في آنٍ واحد، حلم يناقض نفسه.",
      zh: "闪耀的红西柚邂逅丝绒玫瑰与一缕藏红花。清新与深邃并存，一场自相矛盾的梦。",
    },
    "noir-prestige": {
      en: "Smoked sandalwood, black pepper and dark vanilla over glowing amber. Deep, confident and made for the evening.",
      de: "Geräuchertes Sandelholz, schwarzer Pfeffer und dunkle Vanille über glühendem Amber. Tief, selbstbewusst und für den Abend gemacht.",
      fr: "Bois de santal fumé, poivre noir et vanille sombre sur un ambre incandescent. Profond, assuré, fait pour la soirée.",
      pt: "Sândalo defumado, pimenta-preta e baunilha escura sobre âmbar incandescente. Profundo, confiante e feito para a noite.",
      it: "Sandalo affumicato, pepe nero e vaniglia scura su un ambra incandescente. Profondo, sicuro di sé e pensato per la sera.",
      es: "Sándalo ahumado, pimienta negra y vainilla oscura sobre un ámbar resplandeciente. Profundo, seguro y hecho para la noche.",
      ar: "خشب صندل مدخّن وفلفل أسود وفانيلا داكنة فوق عنبر متوهّج. عميق وواثق ومصمّم لأمسيات الليل.",
      zh: "烟熏檀香、黑胡椒与深邃香草，覆于炽热琥珀之上。深沉、自信，为夜晚而生。",
    },
    "rouge-absolu": {
      en: "Crimson rose and ripe raspberry wrapped in precious woods and amber. Bold, velvety and unapologetically passionate.",
      de: "Purpurrote Rose und reife Himbeere, eingehüllt in edle Hölzer und Amber. Kühn, samtig und unverhohlen leidenschaftlich.",
      fr: "Rose cramoisie et framboise mûre enveloppées de bois précieux et d'ambre. Audacieux, velouté et passionné sans détour.",
      pt: "Rosa carmesim e framboesa madura envoltas em madeiras preciosas e âmbar. Ousado, aveludado e apaixonado sem pedir desculpa.",
      it: "Rosa cremisi e lampone maturo avvolti da legni preziosi e ambra. Audace, vellutato e senza timore appassionato.",
      es: "Rosa carmesí y frambuesa madura envueltas en maderas preciosas y ámbar. Atrevido, aterciopelado y apasionado sin disculpas.",
      ar: "وردة قرمزية وتوت العليق الناضج يلفّهما خشب نفيس وعنبر. جريء ومخملي وعاشق بلا اعتذار.",
      zh: "绯红玫瑰与熟透覆盆子，被珍贵木质调与琥珀环绕。大胆、丝绒般柔滑，热情毫无保留。",
    },
    "bleu-eternel": {
      en: "Lavender and white jasmine with a hint of dark berries, settling into smooth wood and amber. Calm, deep and timeless.",
      de: "Lavendel und weißer Jasmin mit einem Hauch dunkler Beeren, die in weichem Holz und Amber ausklingen. Ruhig, tief und zeitlos.",
      fr: "Lavande et jasmin blanc avec une pointe de baies sombres, se posant sur un bois doux et de l'ambre. Calme, profond et intemporel.",
      pt: "Lavanda e jasmim branco com um toque de frutos silvestres escuros, assentando em madeira suave e âmbar. Sereno, profundo e atemporal.",
      it: "Lavanda e gelsomino bianco con una nota di bacche scure, che si posano su legni morbidi e ambra. Calmo, profondo e senza tempo.",
      es: "Lavanda y jazmín blanco con un toque de bayas oscuras, que se asientan en maderas suaves y ámbar. Sereno, profundo y atemporal.",
      ar: "خزامى وياسمين أبيض مع لمسة من التوت الداكن، تستقر على خشب ناعم وعنبر. هادئ وعميق وخالد.",
      zh: "薰衣草与白茉莉，点缀一抹黑莓，最终沉淀于柔和木质调与琥珀之中。宁静、深邃、历久弥新。",
    },
  };

  const byCode = (c) => LANGS.find((l) => l.code === c);
  let cur = "en";
  const listeners = [];

  const stored = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
  const hasChoice = () => !!(stored() && byCode(stored()));
  const guess = () => {
    const prefs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || "en"]);
    for (const p of prefs) { const c = String(p).toLowerCase().slice(0, 2); if (byCode(c)) return c; }
    return "en";
  };
  cur = hasChoice() ? stored() : "en";

  const t = (key, vars) => {
    let s = (S[cur] && S[cur][key]);
    if (s === undefined) s = S.en[key];
    if (typeof s === "string" && vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : ""));
    return s === undefined ? key : s;
  };
  const desc = (id) => (D[id] && (D[id][cur] || D[id].en)) || "";
  const fmtMoney = (n) => new Intl.NumberFormat(byCode(cur).locale, { style: "currency", currency: "EUR" }).format(n);

  // cut a text into the pieces that are revealed one after the other (words; for Chinese: short word groups)
  const splitWords = (text) => {
    try {
      if (window.Intl && Intl.Segmenter) {
        const seg = new Intl.Segmenter(cur, { granularity: "word" });
        const out = []; let gap = true;
        for (const s of seg.segment(text)) {
          if (/^\s+$/.test(s.segment)) { gap = true; continue; }
          // punctuation stays attached to the word before it
          if (!s.isWordLike && !gap && out.length) out[out.length - 1] += s.segment;
          else out.push(s.segment);
          gap = false;
        }
        return out;
      }
    } catch (e) { /* fall through */ }
    return text.split(/\s+/).filter(Boolean);
  };

  // Arabic and Chinese get a fitting display font, loaded only when needed
  const FONT_LINKS = {
    ar: "https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap",
    zh: "https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;500;600&display=swap",
  };
  const loadFont = (code) => {
    const href = FONT_LINKS[code];
    if (!href || document.querySelector(`link[data-lfont="${code}"]`)) return;
    const l = document.createElement("link"); l.rel = "stylesheet"; l.href = href; l.dataset.lfont = code;
    document.head.appendChild(l);
  };

  const applyStatic = () => {
    const l = byCode(cur);
    document.documentElement.lang = l.code;
    document.documentElement.dir = l.dir;
    loadFont(l.code);
    document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll("[data-i18n-aria]").forEach((el) => { el.setAttribute("aria-label", t(el.dataset.i18nAria)); });
    document.querySelectorAll("[data-i18n-ph]").forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
    const d = document.querySelector('meta[name="description"]'); if (d && S[cur].metaDesc) d.setAttribute("content", t("metaDesc"));
    if (document.documentElement.dataset.page === "thanks") document.title = t("thanksDoc"); else document.title = t("title");
  };

  const setLang = (code) => {
    if (!byCode(code)) return;
    cur = code;
    try { localStorage.setItem(KEY, code); } catch {}
    applyStatic();
    listeners.forEach((f) => f(code));
  };

  window.I18N = {
    add: (pack) => Object.keys(pack).forEach((c) => { if (S[c]) Object.assign(S[c], pack[c]); }),
    LANGS, t, phrase: (code, key) => (S[code] && S[code][key]) || S.en[key], desc, noteName, fmtMoney, splitWords, setLang, applyStatic, hasChoice, guess,
    get lang() { return cur; }, get info() { return byCode(cur); },
    onChange: (f) => listeners.push(f),
  };
  applyStatic();
})();
