// Divisors: Japan Post uses 6000, the express couriers 5000.
// These are published industry standards and do not change year to year.
var CARRIERS = [6000, 6000, 5000];
var $ = function (id) { return document.getElementById(id); };

function paint() {
  var g = function (id) { return +$(id).value || 0; };
  var l = g('l'), w = g('w'), h = g('h'), a = g('kg');
  var box = $('result');
  if (!l || !w || !h || !a) { box.innerHTML = '<p class="klabel">—</p>'; return; }

  var rows = CARRIERS.map(function (d, i) {
    var vol = (l * w * h) / d;
    return { name: T.c[i], d: d, vol: vol, billed: Math.ceil(Math.max(a, vol) * 2) / 2 };
  });

  var ems = rows[0];
  var ratio = ems.vol / a;
  var air = Math.max(0, ems.billed - a);
  var v, cls;
  if (ratio >= 2.2) { v = T.vBad.replace('{x}', air.toFixed(1)); cls = 'bad'; }
  else if (ratio >= 1.3) { v = T.vMid.replace('{x}', air.toFixed(1)); cls = 'bad'; }
  else { v = T.vOk; cls = 'ok'; }

  var realPct = Math.min(100, a / ems.billed * 100);

  box.innerHTML =
    '<p class="klabel">' + T.charged + '</p>' +
    '<p class="big">' + ems.billed.toFixed(1) + ' <span>kg</span></p>' +
    '<p class="weighed">' + T.weighed.replace('{a}', a.toFixed(2)) + '</p>' +
    '<div class="bar"><i class="real" style="width:' + realPct.toFixed(0) + '%"></i>' +
    '<i class="air" style="width:' + (100 - realPct).toFixed(0) + '%"></i></div>' +
    '<div class="barlab"><span>' + T.real + ' ' + a.toFixed(1) + ' kg</span>' +
    '<span>' + T.air + ' ' + air.toFixed(1) + ' kg</span></div>' +
    '<div class="verdict ' + cls + '">' + v + '</div>' +
    '<table><tr><th>' + T.svc + '</th><th class="n">' + T.div + '</th>' +
    '<th class="n">' + T.billed + '</th></tr>' +
    rows.map(function (r, i) {
      return '<tr class="' + (i === 0 ? 'hi' : '') + '"><td>' + r.name + '</td>' +
             '<td class="n">÷' + r.d + '</td>' +
             '<td class="n">' + r.billed.toFixed(1) + ' kg</td></tr>';
    }).join('') +
    '</table><div class="tip">' + T.tip + '</div>';
}

['l', 'w', 'h', 'kg'].forEach(function (id) {
  $(id).addEventListener('input', paint);
});
paint();
