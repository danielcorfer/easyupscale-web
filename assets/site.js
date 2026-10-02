// EasyUpscale website: theme switch, before/after sliders, scroll-in. No libraries, no network.
(function () {
  var root = document.documentElement;
  root.classList.add("js");

  // theme: remembered choice, else the system's
  var stored = null;
  try { stored = localStorage.getItem("eu-theme"); } catch (e) {}
  var systemDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  root.setAttribute("data-theme", stored || (systemDark ? "dark" : "light"));

  var toggle = document.getElementById("theme");
  if (toggle) {
    toggle.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("eu-theme", next); } catch (e) {}
    });
  }

  // before / after: the hidden range input does the work (mouse, touch and keyboard)
  document.querySelectorAll("[data-compare]").forEach(function (box) {
    var range = box.querySelector("input[type=range]");
    var set = function () { box.style.setProperty("--pos", range.value + "%"); };
    range.addEventListener("input", set);
    set();
  });

  // sections ease in once
  var items = document.querySelectorAll(".rise");
  if ("IntersectionObserver" in window) {
    var seen = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add("in"); seen.unobserve(entry.target); }
      });
    }, { threshold: 0.12 });
    items.forEach(function (item) { seen.observe(item); });
  } else {
    items.forEach(function (item) { item.classList.add("in"); });
  }

  // buying on the page: the Lemon Squeezy checkout opens as an overlay. Its script is loaded only when someone clicks "Buy",
  // so the page itself makes no third-party requests. Without JavaScript the link simply opens the hosted checkout.
  var LEMON = "https://assets.lemonsqueezy.com/lemon.js";
  document.querySelectorAll("a[data-checkout]").forEach(function (link) {
    link.addEventListener("click", function (event) {
      var open = function () {
        try {
          if (window.createLemonSqueezy) { window.createLemonSqueezy(); }
          window.LemonSqueezy.Url.Open(link.href + (link.href.indexOf("?") < 0 ? "?embed=1" : "&embed=1"));
        } catch (e) { window.location.href = link.href; }
      };
      event.preventDefault();
      if (window.LemonSqueezy) { open(); return; }
      var script = document.createElement("script");
      script.src = LEMON;
      script.onload = open;
      script.onerror = function () { window.location.href = link.href; };
      document.head.appendChild(script);
    });
  });
})();
