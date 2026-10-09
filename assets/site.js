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

  // language: a first visit to a home page goes to the language of the browser; a choice made in the menu is remembered
  var menu = document.querySelector("details.lang");
  if (menu && menu.hasAttribute("data-home")) {
    var chosen = null;
    try { chosen = localStorage.getItem("eu-lang"); } catch (e) {}
    var links = menu.querySelectorAll("a[hreflang]");
    var current = menu.querySelector("a[aria-current]");
    if (!chosen && current && !window.location.search && !window.location.hash) {
      var wanted = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || "en"]);
      for (var i = 0; i < wanted.length; i++) {
        var code = String(wanted[i]).toLowerCase().split("-")[0];
        var match = Array.prototype.find.call(links, function (a) { return a.getAttribute("hreflang") === code; });
        if (match) {
          if (match !== current) { window.location.replace(match.getAttribute("href")); }
          break;
        }
      }
    }
    links.forEach(function (a) {
      a.addEventListener("click", function () { try { localStorage.setItem("eu-lang", a.getAttribute("hreflang")); } catch (e) {} });
    });
  }

  // the language menu closes when you click elsewhere or press Escape
  if (menu) {
    document.addEventListener("click", function (event) { if (!menu.contains(event.target)) { menu.removeAttribute("open"); } });
    document.addEventListener("keydown", function (event) { if (event.key === "Escape") { menu.removeAttribute("open"); } });
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
})();
