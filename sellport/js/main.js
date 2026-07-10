/* ===========================================================================
   SellPort Fulfillment — 인터랙션 (바닐라 JS)
   1) 카운트업 지표 (IntersectionObserver, reduced-motion 대응)
   2) 스크롤 진입 페이드인 (.reveal → .is-visible)
   3) sticky 헤더 그림자 토글
   4) 모바일 메뉴 토글
   5) 견적 폼 검증 + POST /api/quote 제출 (상태: 기본/포커스/에러/제출중/완료/실패)
   =========================================================================== */
(function () {
  "use strict";

  // reduced-motion 여부: 카운트업·페이드인을 즉시 최종 상태로 처리하기 위함
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  /* ----------------------------------------------------------------------
     1) 카운트업 지표
     ---------------------------------------------------------------------- */
  function formatNumber(value, decimals) {
    // 천단위 콤마 + 소수 자릿수 고정 (지표 표기 흔들림 방지)
    return value.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  function runCountUp(el) {
    const target = parseFloat(el.dataset.target || "0");
    const decimals = parseInt(el.dataset.decimals || "0", 10);
    const duration = 1800; // 디자인 스펙 --countup-duration

    // 모션 최소화 설정이면 최종값을 즉시 표기
    if (prefersReducedMotion) {
      el.textContent = formatNumber(target, decimals);
      return;
    }

    const start = performance.now();
    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      // easeOutCubic — 빠르게 시작해 부드럽게 도착
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = formatNumber(target * eased, decimals);
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        el.textContent = formatNumber(target, decimals);
      }
    }
    requestAnimationFrame(tick);
  }

  function initCountUp() {
    const counters = document.querySelectorAll("[data-countup]");
    if (!counters.length) return;

    if (!("IntersectionObserver" in window)) {
      // 폴백: 옵저버 미지원 시 즉시 최종값
      counters.forEach((el) =>
        runCountUp.call(null, ((el.dataset.countup = "1"), el))
      );
      return;
    }

    const observer = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            runCountUp(entry.target);
            obs.unobserve(entry.target); // 1회만 실행
          }
        });
      },
      { threshold: 0.4 }
    );

    counters.forEach((el) => observer.observe(el));
  }

  /* ----------------------------------------------------------------------
     2) 스크롤 진입 페이드인
     ---------------------------------------------------------------------- */
  function initReveal() {
    const items = document.querySelectorAll(".reveal");
    if (!items.length) return;

    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );

    items.forEach((el) => observer.observe(el));
  }

  /* ----------------------------------------------------------------------
     2.5) WMS 대시보드 막대그래프 grow (목업 '진짜 제품' 느낌)
     ---------------------------------------------------------------------- */
  function initWmsBars() {
    const bars = document.querySelectorAll("[data-wms-bar]");
    if (!bars.length) return;

    // 진입 시 data-h(%)만큼 height를 채운다. CSS transition이 grow 처리.
    function fill(el) {
      el.style.height = (el.dataset.h || "0") + "%";
    }

    // 모션 최소화 또는 옵저버 미지원 → 즉시 최종 높이
    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      bars.forEach(fill);
      return;
    }

    const observer = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            fill(entry.target);
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 }
    );
    bars.forEach((el) => observer.observe(el));
  }

  /* ----------------------------------------------------------------------
     3) sticky 헤더 그림자 토글
     ---------------------------------------------------------------------- */
  function initStickyHeader() {
    const header = document.querySelector("[data-nav]");
    if (!header) return;

    function onScroll() {
      if (window.scrollY > 8) {
        header.classList.add("is-scrolled");
      } else {
        header.classList.remove("is-scrolled");
      }
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ----------------------------------------------------------------------
     4) 모바일 메뉴 토글
     ---------------------------------------------------------------------- */
  function initMobileMenu() {
    const toggle = document.querySelector("[data-menu-toggle]");
    const menu = document.querySelector("[data-mobile-menu]");
    if (!toggle || !menu) return;

    function close() {
      menu.classList.add("hidden");
      toggle.setAttribute("aria-expanded", "false");
    }

    toggle.addEventListener("click", function () {
      const isHidden = menu.classList.toggle("hidden");
      toggle.setAttribute("aria-expanded", String(!isHidden));
    });

    // 메뉴 내 링크 클릭 시 닫기
    menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", close));
  }

  /* ----------------------------------------------------------------------
     5) 견적 폼 검증 + 제출
     ---------------------------------------------------------------------- */

  // 필드별 검증 규칙. 반환: 에러 메시지(string) 또는 null(유효)
  const PHONE_RE = /^[0-9\-+\s]{9,20}$/;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function validateField(form, name) {
    const data = new FormData(form);
    switch (name) {
      case "category":
        return data.get("category") ? null : "품목 카테고리를 선택해 주세요.";
      case "volume":
        return data.get("volume") ? null : "월 예상 출고량을 선택해 주세요.";
      case "region":
        return data.get("region") ? null : "주 보관 지역을 선택해 주세요.";
      case "name":
        return String(data.get("name") || "").trim()
          ? null
          : "담당자명을 입력해 주세요.";
      case "contact": {
        // 전화 또는 이메일 중 최소 1개 유효
        const phone = String(data.get("phone") || "").trim();
        const email = String(data.get("email") || "").trim();
        const phoneOk = phone && PHONE_RE.test(phone);
        const emailOk = email && EMAIL_RE.test(email);
        if (!phone && !email)
          return "전화번호 또는 이메일 중 하나는 입력해 주세요.";
        if (phone && !phoneOk && !emailOk)
          return "전화번호 형식을 확인해 주세요. (숫자 9자리 이상)";
        if (email && !emailOk && !phoneOk)
          return "이메일 형식을 확인해 주세요.";
        return phoneOk || emailOk
          ? null
          : "연락처 형식을 확인해 주세요.";
      }
      case "agree":
        return form.querySelector('[name="agree"]').checked
          ? null
          : "개인정보 수집·이용에 동의해 주세요.";
      default:
        return null;
    }
  }

  // 에러 표기 토글 (필드 그룹 단위)
  function setFieldError(form, name, message) {
    const errEl = form.querySelector('[data-error-for="' + name + '"]');
    if (errEl) {
      errEl.textContent = message || errEl.dataset.default || "";
      errEl.classList.toggle("show", Boolean(message));
    }
    // aria-invalid 토글 (contact는 phone/email 두 필드 함께)
    const targets =
      name === "contact"
        ? form.querySelectorAll('[name="phone"], [name="email"]')
        : form.querySelectorAll('[name="' + name + '"]');
    targets.forEach((t) => {
      if (message) t.setAttribute("aria-invalid", "true");
      else t.removeAttribute("aria-invalid");
    });
  }

  function initQuoteForm() {
    const form = document.querySelector("#quote-form");
    if (!form) return;

    const submitBtn = form.querySelector('[type="submit"]');
    const submitLabel = submitBtn.querySelector("[data-btn-label]");
    const spinner = submitBtn.querySelector("[data-spinner]");
    const failBanner = form.querySelector("[data-fail-banner]");
    const failBannerMsg = failBanner
      ? failBanner.querySelector("[data-fail-msg]") || failBanner
      : null;
    const DEFAULT_FAIL_MSG =
      "전송에 실패했습니다. 잠시 후 다시 시도해 주세요.";
    const successPanel = document.querySelector("#quote-success");

    // 서버 에러 코드 → 강조할 필드 그룹 매핑 (없으면 배너만 표기)
    const CODE_TO_FIELD = {
      MISSING_FIELD: null,
      INVALID_VALUE: null,
      CONSENT_REQUIRED: "agree",
      CONTACT_REQUIRED: "contact",
      INVALID_CONTACT: "contact",
    };

    function showFailBanner(message) {
      if (!failBanner) return;
      if (failBannerMsg) failBannerMsg.textContent = message || DEFAULT_FAIL_MSG;
      failBanner.classList.remove("hidden");
      failBanner.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    const fieldGroups = ["category", "volume", "region", "name", "contact", "agree"];

    // blur 시 1차 검증 (해당 필드만)
    fieldGroups.forEach(function (name) {
      const els =
        name === "contact"
          ? form.querySelectorAll('[name="phone"], [name="email"]')
          : form.querySelectorAll('[name="' + name + '"]');
      els.forEach(function (el) {
        const evt = el.type === "checkbox" || el.tagName === "SELECT" ? "change" : "blur";
        el.addEventListener(evt, function () {
          setFieldError(form, name, validateField(form, name));
        });
      });
    });

    function setSubmitting(isSubmitting) {
      submitBtn.disabled = isSubmitting;
      form.classList.toggle("opacity-70", isSubmitting);
      form.classList.toggle("pointer-events-none", isSubmitting);
      if (spinner) spinner.classList.toggle("hidden", !isSubmitting);
      if (submitLabel)
        submitLabel.textContent = isSubmitting ? "전송 중..." : "견적 요청 보내기";
    }

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      if (failBanner) failBanner.classList.add("hidden");

      // 전체 검증
      let firstInvalid = null;
      fieldGroups.forEach(function (name) {
        const msg = validateField(form, name);
        setFieldError(form, name, msg);
        if (msg && !firstInvalid) firstInvalid = name;
      });

      if (firstInvalid) {
        // 첫 에러 필드로 스크롤·포커스
        const target =
          firstInvalid === "contact"
            ? form.querySelector('[name="phone"]')
            : form.querySelector('[name="' + firstInvalid + '"]');
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "center" });
          target.focus({ preventScroll: true });
        }
        return;
      }

      // 페이로드 구성
      const fd = new FormData(form);
      const payload = {
        category: fd.get("category"),
        volume: fd.get("volume"),
        region: fd.get("region"),
        name: String(fd.get("name") || "").trim(),
        phone: String(fd.get("phone") || "").trim(),
        email: String(fd.get("email") || "").trim(),
        memo: String(fd.get("memo") || "").trim(),
        agree: form.querySelector('[name="agree"]').checked,
      };

      setSubmitting(true);

      // 전송 대상: config.js의 SITE_CONFIG.quoteEndpoint 가 있으면 그곳(운영=Apps Script),
      // 없으면 로컬 Node 서버(/api/quote).
      const endpoint =
        (window.SITE_CONFIG && window.SITE_CONFIG.quoteEndpoint) || "/api/quote";
      const isExternal = /^https?:\/\//i.test(endpoint);

      try {
        if (isExternal) {
          // 정적 호스팅(서버 없음) → 구글 Apps Script 웹앱으로 직접 전송.
          // Apps Script는 CORS 응답 헤더가 없어 응답을 읽을 수 없으므로,
          // no-cors + text/plain(프리플라이트 회피)으로 보내고 성공 처리한다.
          // 클라이언트 검증을 이미 통과했고, 리드는 Apps Script가 시트·메일·알림으로 저장.
          await fetch(endpoint, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload),
          });
          form.classList.add("hidden");
          if (successPanel) {
            successPanel.classList.remove("hidden");
            successPanel.classList.add("flex");
            successPanel.scrollIntoView({ behavior: "smooth", block: "center" });
            successPanel.setAttribute("tabindex", "-1");
            successPanel.focus({ preventScroll: true });
          }
          return;
        }

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        // 응답 바디 파싱(비-JSON 대비 안전 처리)
        const body = await res.json().catch(() => ({}));

        // 성공: res.ok && body.ok === true (백엔드 SSOT 규약)
        if (res.ok && body && body.ok === true) {
          form.classList.add("hidden");
          if (successPanel) {
            successPanel.classList.remove("hidden");
            successPanel.classList.add("flex");
            successPanel.scrollIntoView({ behavior: "smooth", block: "center" });
            successPanel.setAttribute("tabindex", "-1");
            successPanel.focus({ preventScroll: true });
          }
          return;
        }

        // 검증 실패(4xx + code): 메시지 배너 + 해당 필드 강조
        if (res.status === 429) {
          showFailBanner("요청이 많습니다. 잠시 후 다시 시도해 주세요.");
        } else if (body && body.code) {
          showFailBanner(body.error || DEFAULT_FAIL_MSG);
          const fieldName = CODE_TO_FIELD[body.code];
          if (fieldName) {
            setFieldError(form, fieldName, body.error || "확인이 필요합니다.");
          }
        } else {
          // 5xx 또는 알 수 없는 응답
          showFailBanner(DEFAULT_FAIL_MSG);
        }
        setSubmitting(false);
      } catch (err) {
        // 네트워크 단절 등: 상단 배너 노출 + 버튼 재활성
        console.error("견적 제출 실패:", err);
        showFailBanner(DEFAULT_FAIL_MSG);
        setSubmitting(false);
      }
    });
  }

  /* ----------------------------------------------------------------------
     초기화
     ---------------------------------------------------------------------- */
  function init() {
    initCountUp();
    initReveal();
    initWmsBars();
    initStickyHeader();
    initMobileMenu();
    initQuoteForm();

    // 현재 연도 푸터 주입
    const yearEl = document.querySelector("[data-year]");
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
