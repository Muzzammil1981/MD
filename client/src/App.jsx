import { useEffect, useState } from "react";
import {
  ArrowRight, Menu, Minus, Plus, ShoppingBag, Sparkles, Star, Trash2,
  User, X, LogOut, ExternalLink,
} from "lucide-react";
import { io } from "socket.io-client";

import LoginPage from "./pages/LoginPage";
import AdminDashboard from "./pages/AdminDashboard";
import AuthModal from "./pages/AuthModal";
import AccountModal from "./pages/AccountModal";
import BookingModal from "./pages/BookingModal";
import MyOrdersModal from "./pages/MyOrdersModal";
import ModifyOrderModal from "./pages/ModifyOrderModal";
import PaymentModal from "./pages/PaymentModal";
import EventPage from "./pages/EventPage";
import MonitorPage from "./pages/MonitorPage";
import CustomisePage from "./pages/CustomisePage";
import { api, API_BASE } from "./lib/api";
import { playNotificationSound, primeAudioOnFirstGesture } from "./lib/notify";
import { imageUrl, currency } from "./lib/format";
import SafeImage from "./components/SafeImage";
import Catalog from "./components/Catalog";
import ReviewsSection from "./components/ReviewsSection";
import DesignReviews from "./components/DesignReviews";
import { B } from "./lib/brand";

const API = API_BASE;


function App() {
  const isAdminRoute = window.location.pathname.startsWith("/admin");
  const isMonitorRoute = window.location.pathname.startsWith("/monitor");
  const [adminUser, setAdminUser] = useState(null);
  const [checking, setChecking] = useState(true);

  const [activeEvent, setActiveEvent] = useState(null);
  const [checkingEvent, setCheckingEvent] = useState(!isAdminRoute && !isMonitorRoute);

  useEffect(() => {
    if (!isAdminRoute) { setChecking(false); return; }
    const token = localStorage.getItem("mehndi-token");
    if (!token) { setChecking(false); return; }
    api.get("/api/auth/me")
      .then(({ data }) => setAdminUser(data.user))
      .catch(() => localStorage.removeItem("mehndi-token"))
      .finally(() => setChecking(false));
  }, [isAdminRoute]);

  useEffect(() => {
    if (isAdminRoute || isMonitorRoute) return;

    const urlParams = new URLSearchParams(window.location.search);
    const eventIdFromUrl = urlParams.get("event");

    const loadEvent = async () => {
      try {
        // The home page is ALWAYS the normal catalogue. An event page opens only when the
        // visitor arrives through that event's own link / QR code (?event=<id>).
        if (eventIdFromUrl) {
          const { data } = await api.get(`/api/events/${eventIdFromUrl}`);
          if (data?.event) setActiveEvent(data.event);
        }
      } catch (err) {
        console.error("Failed to load event:", err?.response?.data || err.message);
      } finally {
        setCheckingEvent(false);
      }
    };

    loadEvent();
  }, [isAdminRoute, isMonitorRoute]);

  const logout = () => {
    localStorage.removeItem("mehndi-token");
    setAdminUser(null);
  };

  useEffect(() => { primeAudioOnFirstGesture(); }, []);

  if (isMonitorRoute) {
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get("event");
    return <MonitorPage eventId={eventId} />;
  }

  if (isAdminRoute) {
    if (checking) {
      return <div className="grid min-h-screen place-items-center bg-[#1b100b] text-[#f1cf8a]"><div className="serif text-2xl animate-pulse">Loading studio…</div></div>;
    }
    if (!adminUser) return <LoginPage onLogin={setAdminUser} />;
    return <AdminDashboard user={adminUser} onLogout={logout} />;
  }

  if (checkingEvent) {
    return <div className="grid min-h-screen place-items-center bg-[#1b100b] text-[#f1cf8a]"><div className="serif text-2xl animate-pulse">Loading…</div></div>;
  }

  return <PublicCatalog activeEvent={activeEvent} />;
}

/* PUBLIC SITE */
function PublicCatalog({ activeEvent }) {
  const [categories, setCategories] = useState(B.categories);
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  const [user, setUser] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [pendingDesign, setPendingDesign] = useState(null);

  const [bookingOpen, setBookingOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState(null);
  const [modifyOrder, setModifyOrder] = useState(null);

  // Customise feature
  const [customiseOpen, setCustomiseOpen] = useState(false);
  const [pendingCustomise, setPendingCustomise] = useState(false);

  const [cart, setCart] = useState([]);
  const [selectedItems, setSelectedItems] = useState(new Set());

  useEffect(() => {
    const token = localStorage.getItem("mehndi-user-token");
    if (!token) return;
    api.get("/api/users/me").then(({ data }) => setUser(data.user)).catch(() => localStorage.removeItem("mehndi-user-token"));
  }, []);

  useEffect(() => {
    api.get("/api/categories").then(({ data }) => { if (Array.isArray(data) && data.length) setCategories(data); }).catch(() => { });
  }, []);

  useEffect(() => {
    if (!user) { setCart([]); setSelectedItems(new Set()); return; }
    try {
      const saved = JSON.parse(localStorage.getItem(`mehndi-cart-${user.id}`) || "[]");
      setCart(Array.isArray(saved) ? saved : []);
      setSelectedItems(new Set());
    } catch { setCart([]); setSelectedItems(new Set()); }
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    localStorage.setItem(`mehndi-cart-${user.id}`, JSON.stringify(cart));
  }, [cart, user?.id]);

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("mehndi-user-token");
    const socket = io(API, { auth: { token } });
    socket.on("notification", (n) => {
      playNotificationSound(n.status === "approved" ? "success" : n.status === "rejected" ? "error" : "info");
      if (n.type === "order-update") window.dispatchEvent(new CustomEvent("mehndi:order-update", { detail: n }));
    });
    return () => socket.disconnect();
  }, [user?.id]);

  const doAddToCart = (design) => {
    setCart(prev => {
      const found = prev.find(x => x.id === design.id);
      if (found) return prev.map(x => x.id === design.id ? { ...x, qty: x.qty + 1 } : x);
      return [...prev, { ...design, qty: 1 }];
    });
    setSelected(null);
    setCartOpen(true);
  };

  const addToCart = (design) => {
    if (!user) { setPendingDesign(design); setAuthOpen(true); return; }
    doAddToCart(design);
  };

  const handleAuthSuccess = (u) => {
    setUser(u);
    setAuthOpen(false);
    if (pendingDesign) { setTimeout(() => doAddToCart(pendingDesign), 100); setPendingDesign(null); }
    if (pendingCustomise) {
      setPendingCustomise(false);
      setCustomiseOpen(true);
    }
  };

  /* Navigation: close customise/menu first, then scroll to the section */
  const navigateTo = (targetId) => {
    setMobileMenu(false);
    const wasCustomiseOpen = customiseOpen;
    if (wasCustomiseOpen) setCustomiseOpen(false);

    // Wait for React to re-render the catalog, then scroll
    setTimeout(() => {
      if (targetId) document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth" });
      else window.scrollTo({ top: 0, behavior: "smooth" });
    }, wasCustomiseOpen ? 80 : 0);
  };

  /* Customise is now a TOGGLE — click again to exit */
  const toggleCustomise = () => {
    setMobileMenu(false);
    if (customiseOpen) { setCustomiseOpen(false); return; }
    if (!user) {
      setPendingCustomise(true);
      setAuthOpen(true);
      return;
    }
    setCustomiseOpen(true);
  };

  const userLogout = () => {
    localStorage.removeItem("mehndi-user-token");
    setUser(null); setCart([]); setSelectedItems(new Set()); setCartOpen(false); setAccountOpen(false); setOrdersOpen(false); setBookingOpen(false); setPaymentOrder(null); setModifyOrder(null); setCustomiseOpen(false);
  };

  const toggleItem = (id) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedItems.size === cart.length) setSelectedItems(new Set());
    else setSelectedItems(new Set(cart.map(x => x.id)));
  };

  const cartCount = cart.reduce((n, x) => n + x.qty, 0);
  const cartTotal = cart.reduce((n, x) => n + x.qty * x.price, 0);
  const selectedCartItems = cart.filter(i => selectedItems.has(i.id));
  const selectedTotal = selectedCartItems.reduce((n, x) => n + x.qty * x.price, 0);

  return (
    <div className="min-h-screen bg-[#fbf8f2] text-[#2a1a12]">
      <Header
        count={cartCount}
        onCart={() => (user ? setCartOpen(true) : setAuthOpen(true))}
        onMenu={() => setMobileMenu(!mobileMenu)}
        user={user}
        onSignIn={() => setAuthOpen(true)}
        onSignOut={userLogout}
        onAccount={() => setAccountOpen(true)}
        onOrders={() => setOrdersOpen(true)}
        onCustomise={toggleCustomise}
        onNavigate={navigateTo}
        customiseActive={customiseOpen}
      />

      {mobileMenu && (
        <MobileMenu
          setMobileMenu={setMobileMenu}
          setActiveCategory={setActiveCategory}
          user={user}
          onSignIn={() => setAuthOpen(true)}
          onSignOut={userLogout}
          onAccount={() => setAccountOpen(true)}
          onOrders={() => setOrdersOpen(true)}
          onCustomise={toggleCustomise}
          onNavigate={navigateTo}
        />
      )}

      <main>
        {customiseOpen ? (
          <CustomisePage
            user={user}
            activeEvent={activeEvent}
            onRequireAuth={() => { setPendingCustomise(true); setAuthOpen(true); }}
            onSubmitted={() => { /* optional: could auto-open orders */ }}
            onBack={() => setCustomiseOpen(false)}
          />
        ) : activeEvent ? (
          <EventPage event={activeEvent} onAddToCart={addToCart} onSelect={setSelected} />
        ) : (
          <>
            <Hero onExplore={() => navigateTo("catalog")} />
            <CategoryRail categories={categories} active={activeCategory} setActive={setActiveCategory} />
            <Catalog
              categories={categories}
              activeCategory={activeCategory}
              setActiveCategory={setActiveCategory}
              search={search}
              setSearch={setSearch}
              onSelect={setSelected}
              onAdmin={() => { window.location.href = "/admin"; }}
            />
            <ReviewsSection />
            <Story />
          </>
        )}
      </main>

      <Footer />

      {selected && <DesignModal design={selected} onClose={() => setSelected(null)} onAdd={addToCart} />}
      {cartOpen && user && <CartDrawer cart={cart} setCart={setCart} total={cartTotal} selectedItems={selectedItems} toggleItem={toggleItem} toggleAll={toggleAll} onClose={() => setCartOpen(false)} onProceed={() => { setCartOpen(false); setBookingOpen(true); }} />}
      {authOpen && <AuthModal reason={pendingDesign ? `Create an account or sign in to add this ${B.item} to your selection.` : pendingCustomise ? `Sign in to create your ${B.customRequest}.` : null} onClose={() => { setAuthOpen(false); setPendingDesign(null); setPendingCustomise(false); }} onSuccess={handleAuthSuccess} />}
      {accountOpen && user && <AccountModal user={user} onClose={() => setAccountOpen(false)} onSignOut={userLogout} />}
      {bookingOpen && user && selectedCartItems.length > 0 && (
        <BookingModal
          cart={selectedCartItems}
          total={selectedTotal}
          activeEvent={activeEvent}
          onClose={() => setBookingOpen(false)}
          onSuccess={(order) => {
            const remaining = cart.filter(i => !selectedItems.has(i.id));
            setCart(remaining);
            setSelectedItems(new Set());
            setBookingOpen(false);

            if (order.eventId) {
              setPaymentOrder(order);
            } else {
              setOrdersOpen(true);
            }
          }}
        />
      )}

      {ordersOpen && user && (
        <MyOrdersModal
          onClose={() => setOrdersOpen(false)}
          onPay={(order) => { setOrdersOpen(false); setPaymentOrder(order); }}
          onModify={(order) => { setOrdersOpen(false); setModifyOrder(order); }}
        />
      )}

      {modifyOrder && (
        <ModifyOrderModal
          order={modifyOrder}
          activeEvent={activeEvent}
          onClose={() => setModifyOrder(null)}
          onSuccess={(updatedOrder) => {
            setModifyOrder(null);
            const balance = Number(updatedOrder.balanceDue) || 0;
            const refund = Number(updatedOrder.refundDue) || 0;

            // Only route to PaymentModal when there's an outstanding balance to top up.
            // Refund cases (refund > 0) or no-change edits just reopen the orders list.
            if (updatedOrder.status === "approved" && balance > 0) {
              setPaymentOrder(updatedOrder);
            } else {
              setOrdersOpen(true);
            }

            if (refund > 0) {
              console.info(`[modify] refund due: ${refund}`);
            }
          }}
        />
      )}

      {paymentOrder && user && <PaymentModal order={paymentOrder} onClose={() => setPaymentOrder(null)} onPaid={() => { setPaymentOrder(null); setOrdersOpen(true); }} />}
    </div>
  );
}

/* HEADER */
function Header({ count, onCart, onMenu, user, onSignIn, onSignOut, onAccount, onOrders, onCustomise, onNavigate, customiseActive }) {
  return (
    <header className="sticky top-0 z-40 border-b border-[#eadfce] bg-[#fbf8f2]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-8">
        <button
          type="button"
          onClick={() => onNavigate?.("catalog")}
          className="flex items-center gap-3"
        >
          <div className="grid h-10 w-10 place-items-center rounded-full bg-[#24170f] text-[#f1cf8a]"><span className="serif text-xl">{B.initial}</span></div>
          <div className="text-left">
            <div className="serif text-xl font-bold tracking-tight">{B.name}</div>
            <div className="text-[9px] uppercase tracking-[.28em] text-[#8a6d53]">{B.tagline}</div>
          </div>
        </button>
        <nav className="hidden items-center gap-8 text-sm font-medium lg:flex">
          <button type="button" onClick={() => onNavigate?.("catalog")} className="hover:text-[#9b5d32]">{B.Items}</button>
          <button type="button" onClick={() => onNavigate?.("categories")} className="hover:text-[#9b5d32]">Categories</button>
          <button
            type="button"
            onClick={onCustomise}
            className={`transition hover:text-[#9b5d32] ${customiseActive ? "text-[#7d3f24] font-bold" : ""}`}
          >
            ✨ Customise
          </button>
          <button type="button" onClick={() => onNavigate?.("story")} className="hover:text-[#9b5d32]">Our Story</button>
          <a href="/admin" className="rounded-full border border-[#ded0bc] bg-white px-4 py-1.5 hover:bg-[#f4eadc]">Admin</a>
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <div className="hidden items-center gap-2 lg:flex">
              <button onClick={onOrders} className="flex items-center gap-2 rounded-full border border-[#ded0bc] bg-white px-4 py-2 text-sm font-semibold hover:bg-[#f4eadc]">📅 My orders</button>
              <button onClick={onAccount} title="Account settings" className="flex items-center gap-2 rounded-full border border-[#ded0bc] bg-white px-4 py-2 hover:bg-[#f4eadc]"><User size={15} className="text-[#7d3f24]" /><span className="max-w-[120px] truncate text-sm font-semibold">{user.username}</span></button>
              <button onClick={onSignOut} title="Sign out" className="flex items-center gap-2 rounded-full border border-[#e6c4be] bg-white px-4 py-2 text-sm font-semibold text-[#9b3b2b] hover:bg-[#f7e9e6]"><LogOut size={15} /> Sign out</button>
            </div>
          ) : (
            <button onClick={onSignIn} className="hidden items-center gap-2 rounded-full border border-[#ded0bc] bg-white px-4 py-2 text-sm font-semibold hover:bg-[#f4eadc] lg:flex"><User size={15} /> Sign in</button>
          )}
          <button onClick={onMenu} className="rounded-full p-3 hover:bg-[#f0e6d8] lg:hidden"><Menu size={20} /></button>
          <button onClick={onCart} className="relative rounded-full border border-[#ded0bc] bg-white p-3 shadow-sm transition hover:-translate-y-0.5">
            <ShoppingBag size={19} />
            {count > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#7d3f24] px-1 text-[10px] font-bold text-white">{count}</span>}
          </button>
        </div>
      </div>
    </header>
  );
}

function MobileMenu({ setMobileMenu, setActiveCategory, user, onSignIn, onSignOut, onAccount, onOrders, onCustomise, onNavigate }) {
  const pickCategory = (id) => {
    setActiveCategory(id);
    onNavigate?.("catalog");
  };

  return <div className="fixed inset-x-0 top-20 z-30 border-b border-[#eadfce] bg-[#fffdf9] p-5 shadow-xl lg:hidden">
    <div className="grid gap-2">
      {["all", ...B.categories.map(c => c.id)].map(x =>
        <button key={x} onClick={() => pickCategory(x)} className="rounded-xl px-4 py-3 text-left text-sm capitalize hover:bg-[#f4eadc]">{x === "all" ? `All ${B.Items}` : (B.categories.find(c => c.id === x)?.name || x)}</button>
      )}

      <button
        onClick={() => { onCustomise?.(); }}
        className="rounded-xl bg-gradient-to-r from-[#f1cf8a]/40 to-[#f1cf8a]/20 px-4 py-3 text-left text-sm font-semibold text-[#7d3f24]"
      >
        ✨ Customise your design
      </button>

      {user ? (
        <>
          <button onClick={() => { setMobileMenu(false); onOrders(); }} className="flex items-center gap-2 rounded-xl border border-[#ded0bc] bg-white px-4 py-3 text-left text-sm font-semibold">📅 My orders</button>
          <button onClick={() => { setMobileMenu(false); onAccount(); }} className="flex items-center gap-2 rounded-xl border border-[#ded0bc] bg-white px-4 py-3 text-left text-sm font-semibold"><User size={15} /> {user.username}</button>
          <button onClick={() => { setMobileMenu(false); onSignOut(); }} className="flex items-center gap-2 rounded-xl border border-[#e6c4be] bg-white px-4 py-3 text-left text-sm font-semibold text-[#9b3b2b]"><LogOut size={15} /> Sign out</button>
        </>
      ) : (
        <button onClick={() => { setMobileMenu(false); onSignIn(); }} className="flex items-center gap-2 rounded-xl border border-[#ded0bc] bg-white px-4 py-3 text-left text-sm font-semibold"><User size={15} /> Sign in</button>
      )}
      <a href="/admin" className="rounded-xl bg-[#24170f] px-4 py-3 text-left text-sm font-semibold text-white">Open Admin</a>
    </div>
  </div>;
}

function Hero({ onExplore }) {
  return <section className="hero-pattern relative overflow-hidden">
    <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:py-28">
      <div>
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#dfc9a8] bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[.18em] text-[#835b38]"><Sparkles size={14} /> {B.heroKicker}</div>
        <h1 className="serif max-w-3xl text-5xl font-semibold leading-[.98] tracking-[-.04em] sm:text-6xl lg:text-8xl">{B.heroTitle1}<br /><span className="italic text-[#8c4e2f]">{B.heroTitle2}</span></h1>
        <p className="mt-7 max-w-xl text-base leading-7 text-[#715e4e] sm:text-lg">{B.heroText}</p>
        <div className="mt-9 flex flex-wrap gap-3">
          <button onClick={onExplore} className="group inline-flex items-center gap-3 rounded-full bg-[#24170f] px-6 py-3.5 text-sm font-semibold text-white shadow-luxe transition hover:-translate-y-0.5">{B.exploreLabel} <ArrowRight size={17} className="transition group-hover:translate-x-1" /></button>
          <div className="flex items-center gap-2 rounded-full border border-[#ddcdb8] bg-white/70 px-5 py-3.5 text-sm text-[#715e4e]"><Star size={15} className="fill-[#bd8b48] text-[#bd8b48]" /> {B.heroBadge}</div>
        </div>
      </div>
      <HeroArtwork />
    </div>
  </section>;
}

function HeroArtwork() {
  return <div className="relative mx-auto aspect-[4/5] w-full max-w-[520px]">
    <div className="absolute inset-8 rotate-[-5deg] rounded-[45%_45%_10%_10%] bg-[#e7d5bd]" />
    <div className="absolute inset-5 overflow-hidden rounded-[45%_45%_10%_10%] border border-white/70 bg-gradient-to-b from-[#eadac7] to-[#d1b595] shadow-luxe">
      <div className="absolute inset-0 opacity-70" style={{ backgroundImage: "radial-gradient(#8b5a36 1.2px, transparent 1.2px)", backgroundSize: "18px 18px" }} />
      <div className="absolute left-[17%] top-[17%] h-28 w-28 rotate-45 border-[3px] border-[#754327] opacity-90" />
      <div className="absolute right-[16%] top-[31%] h-24 w-24 rounded-full border-[3px] border-[#754327]" />
      <div className="absolute left-[28%] top-[48%] h-40 w-40 rounded-full border-[3px] border-[#754327]" />
      <div className="absolute bottom-[12%] left-[16%] right-[16%] h-20 rounded-full border-[3px] border-[#754327]" />
      <div className="absolute inset-x-10 bottom-8 text-center text-[#6f4027]"><div className="serif text-4xl italic">{B.heroArt}</div><div className="mt-1 text-[9px] uppercase tracking-[.5em]">{B.heroArtSub}</div></div>
    </div>
    <div className="absolute -bottom-2 -left-2 rounded-2xl border border-[#e2d1bb] bg-white/85 p-4 shadow-xl backdrop-blur"><div className="text-[10px] uppercase tracking-[.2em] text-[#92765c]">Collection</div><div className="serif mt-1 text-xl">{B.categories.length} {B.heroCardTitle}</div></div>
  </div>;
}

function CategoryRail({ categories, active, setActive }) {
  return <section id="categories" className="border-y border-[#eadfce] bg-[#fffdf9]">
    <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
      <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
        <button onClick={() => setActive("all")} className={`shrink-0 rounded-full border px-5 py-2.5 text-sm font-semibold transition ${active === "all" ? "border-[#24170f] bg-[#24170f] text-white" : "border-[#ded0bc] bg-white hover:bg-[#f4eadc]"}`}>{B.allLabel}</button>
        {categories.map(c => <button key={c.id} onClick={() => setActive(c.id)} className={`shrink-0 rounded-full border px-5 py-2.5 text-sm font-semibold transition ${active === c.id ? "border-[#7d3f24] bg-[#7d3f24] text-white" : "border-[#ded0bc] bg-white hover:bg-[#f4eadc]"}`}>{c.shortName}</button>)}
      </div>
    </div>
  </section>;
}

function DesignModal({ design, onClose, onAdd }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#20140e]/60 p-3 backdrop-blur-sm sm:p-4" onMouseDown={onClose}>
      <div onMouseDown={(e) => e.stopPropagation()} className="flex w-full flex-col overflow-hidden rounded-[24px] bg-[#fffdf9] shadow-2xl max-h-[94dvh] sm:max-w-xl sm:rounded-[30px] md:max-h-[92dvh] md:max-w-4xl md:flex-row">
        <div className="flex shrink-0 items-center justify-center bg-[#eadcc9] p-2 sm:p-3 md:w-1/2 md:p-4">
          <SafeImage src={imageUrl(design.image)} alt={design.name} eager fallbackClassName="h-56 w-56 rounded-xl" className="block h-auto w-auto max-w-full rounded-xl object-contain max-h-[40dvh] sm:max-h-[46dvh] md:max-h-[84dvh]" />
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-5 sm:p-7 md:w-1/2 md:p-8">
          <div className="flex shrink-0 justify-end"><button onClick={onClose} aria-label="Close" className="rounded-full p-2 text-[#24170f] transition hover:bg-[#f1e6d8] active:scale-95"><X size={20} /></button></div>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="mt-1 text-[10px] font-bold uppercase tracking-[.2em] text-[#9a7352] sm:text-xs">{design.categoryName}</div>
            <h2 className="serif mt-2 text-3xl font-semibold leading-tight text-[#24170f] sm:text-4xl">{design.name}</h2>
            <p className="mt-4 text-sm leading-6 text-[#725e4c] sm:mt-5 sm:text-base sm:leading-7">{design.description || B.defaultDescription}</p>
            <div className="mt-5 rounded-2xl bg-[#f3e9dc] p-4 sm:mt-7 sm:p-5">
              <div className="text-[10px] uppercase tracking-[.15em] text-[#927158] sm:text-xs">Price</div>
              <div className="mt-1 flex items-end gap-2"><span className="serif text-2xl font-bold text-[#24170f] sm:text-3xl">{currency(design.price)}</span><span className="pb-1 text-[10px] text-[#806b58] sm:text-xs">{design.amountType}</span></div>
            </div>
            <DesignReviews designId={design.id} />
          </div>
          <div className="shrink-0 border-t border-[#eadcc9] bg-[#fffdf9] pt-4 sm:pt-5">
            <button onClick={() => onAdd(design)} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#24170f] px-5 py-3.5 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#382419] active:scale-[0.99] sm:py-4"><ShoppingBag size={17} /> Add to selection</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CartDrawer({ cart, setCart, total, selectedItems, toggleItem, toggleAll, onClose, onProceed }) {
  const update = (id, delta) => setCart(prev => prev.map(x => x.id === id ? { ...x, qty: Math.max(1, x.qty + delta) } : x));
  const allSelected = cart.length > 0 && selectedItems.size === cart.length;
  const someSelected = selectedItems.size > 0 && selectedItems.size < cart.length;
  const selectedTotal = cart.filter(i => selectedItems.has(i.id)).reduce((n, x) => n + x.qty * x.price, 0);

  return (
    <div className="fixed inset-0 z-50 bg-[#20140e]/45" onMouseDown={onClose}>
      <aside onMouseDown={e => e.stopPropagation()} className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-[#fffdf9] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#eadfce] p-6">
          <div><div className="text-xs font-bold uppercase tracking-[.2em] text-[#9a7352]">Your selection</div><h2 className="serif mt-1 text-3xl">Cart</h2></div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-[#f1e6d8]"><X /></button>
        </div>
        {cart.length > 0 && (
          <div className="flex items-center justify-between border-b border-[#eadfce] bg-[#faf5ed] px-5 py-3">
            <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={allSelected} ref={el => { if (el) el.indeterminate = someSelected; }} onChange={toggleAll} className="h-4 w-4 accent-[#7d3f24]" />Select all ({cart.length})</label>
            <span className="text-xs text-[#8a6d53]">{selectedItems.size} selected</span>
          </div>
        )}
        <div className="flex-1 overflow-auto p-5">
          {cart.length === 0 ? (
            <div className="grid h-full place-items-center text-center"><div><ShoppingBag className="mx-auto text-[#9a7352]" size={35} /><p className="serif mt-4 text-2xl">Your selection is empty.</p><p className="mt-2 text-sm text-[#806b58]">Add {B.items} you would like to keep together.</p></div></div>
          ) : (
            <div className="space-y-4">
              {cart.map(item => {
                const isSelected = selectedItems.has(item.id);
                return (
                  <div key={item.id} className={`flex gap-3 rounded-2xl border p-3 transition ${isSelected ? "border-[#7d3f24] bg-[#fdf7ee]" : "border-[#eadfce] bg-white"}`}>
                    <label className="flex shrink-0 cursor-pointer items-start pt-1"><input type="checkbox" checked={isSelected} onChange={() => toggleItem(item.id)} className="h-4 w-4 accent-[#7d3f24]" /></label>
                    <SafeImage src={imageUrl(item.image, "thumb")} alt="" className="h-24 w-20 rounded-xl object-cover" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{item.name}</div>
                      <div className="mt-1 text-xs text-[#806b58]">{item.amountType}</div>
                      <div className="mt-2 font-bold">{currency(item.price)}</div>
                      <div className="mt-2 flex items-center gap-2">
                        <button onClick={() => update(item.id, -1)} className="rounded-full border p-1"><Minus size={12} /></button>
                        <span className="w-5 text-center text-xs">{item.qty}</span>
                        <button onClick={() => update(item.id, 1)} className="rounded-full border p-1"><Plus size={12} /></button>
                      </div>
                    </div>
                    <button onClick={() => setCart(prev => prev.filter(x => x.id !== item.id))} className="self-start p-1 text-[#a17e63] hover:text-[#7d3f24]"><Trash2 size={16} /></button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {cart.length > 0 && (
          <div className="border-t border-[#eadfce] p-5">
            <div className="flex justify-between text-sm text-[#806b58]"><span>Subtotal</span><span>{currency(total)}</span></div>
            {selectedItems.size > 0 && selectedItems.size < cart.length && <div className="mt-1 flex justify-between text-sm font-semibold text-[#7d3f24]"><span>Selected ({selectedItems.size})</span><span>{currency(selectedTotal)}</span></div>}
            <button onClick={onProceed} disabled={selectedItems.size === 0} className="mt-4 w-full rounded-full bg-[#24170f] px-6 py-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{selectedItems.size === 0 ? "Select items to continue" : `Continue with ${selectedItems.size} item${selectedItems.size > 1 ? "s" : ""}`}</button>
            <p className="mt-3 text-center text-[10px] text-[#9a846f]">Pick your appointment date and time next.</p>
          </div>
        )}
      </aside>
    </div>
  );
}

function Story() {
  return <section id="story" className="border-t border-[#eadfce] bg-[#24170f] text-[#fff9ef]">
    <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 lg:grid-cols-2 lg:px-8">
      <div><div className="text-xs font-bold uppercase tracking-[.24em] text-[#d8b37b]">{B.storyKicker}</div><h2 className="serif mt-3 text-5xl leading-tight">{B.storyTitle}</h2></div>
      <div className="text-[#d9c9b8]">
        <p className="leading-7">{B.storyText}</p>
        <div className="mt-8 grid grid-cols-3 gap-4 border-t border-white/10 pt-7 text-center">
          <div><div className="serif text-3xl text-white">{String(B.categories.length).padStart(2, "0")}</div><div className="mt-1 text-[10px] uppercase tracking-[.16em]">{B.storyStat1}</div></div>
          <div><div className="serif text-3xl text-white">∞</div><div className="mt-1 text-[10px] uppercase tracking-[.16em]">{B.storyStat2}</div></div>
          <div><div className="serif text-3xl text-white">01</div><div className="mt-1 text-[10px] uppercase tracking-[.16em]">{B.storyStat3}</div></div>
        </div>
      </div>
    </div>
  </section>;
}

function Footer() {
  return (
    <footer className="relative overflow-hidden bg-[#1b100b] px-5 pt-12 pb-8 text-center text-xs text-[#aa9480]">
      <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(#c69a63 1px, transparent 1px)", backgroundSize: "22px 22px" }} />
      <div className="relative">
        <div className="serif text-xl text-[#eee0cf]">{B.name}</div>
        <div className="mt-2">{B.footerTagline}</div>
        <div className="mt-7 flex items-center justify-center gap-3 text-[11px]">
          <span className="text-[#7a6250]">Powered by</span>
          <a href="https://m-technology.in/" target="_blank" rel="noopener noreferrer" className="group inline-flex items-center gap-1.5 rounded-full border border-[#3a2418] bg-gradient-to-r from-[#24170f] to-[#2d1a11] px-4 py-2 font-semibold text-[#f1cf8a] shadow-lg shadow-black/40 transition hover:-translate-y-0.5 hover:border-[#f1cf8a]/50"><Sparkles size={12} className="transition group-hover:rotate-12" /><span>M-Technology</span><ExternalLink size={11} className="transition group-hover:translate-x-0.5" /></a>
        </div>
        <div className="mt-7 border-t border-white/5 pt-5 text-[10px] text-[#7a6250]">© {new Date().getFullYear()} {B.name} · All rights reserved</div>
      </div>
    </footer>
  );
}

export default App;