(function(){
  var SUPABASE_URL = "https://onbsgohvqejccowfnrbs.supabase.co";
  var ANON_KEY = "sb_publishable_Tiz8pcjnik-Xj85Jvahivw_dfNqf_TT";
  var token = new URLSearchParams(location.search).get('token');
  var stateEl = document.getElementById('state');
  function show(id){ document.getElementById(id).hidden = false; }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function fmtDate(d){ try{ return new Date(d+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'}); }catch(e){ return d; } }

  if(!token){ stateEl.hidden=true; show('errCard'); document.getElementById('errTxt').textContent = 'Lien invalide (aucun jeton).'; }
  else {
    fetch(SUPABASE_URL + '/functions/v1/spectator-view?token=' + encodeURIComponent(token), {
      headers: { apikey: ANON_KEY, Authorization: 'Bearer ' + ANON_KEY }
    }).then(function(r){ return r.json().then(function(j){ return {ok:r.ok, body:j}; }); })
      .then(function(res){
        stateEl.hidden = true;
        if(!res.ok){ show('errCard'); document.getElementById('errTxt').textContent = (res.body && res.body.error) || 'Lien introuvable.'; return; }
        var d = res.body;
        document.getElementById('raceTitle').textContent = d.raceName || 'Course';
        document.getElementById('raceSub').textContent = esc(d.athleteName) + ' — ' + fmtDate(d.raceDate);
        if(d.pacingNotes){ document.getElementById('notesTxt').textContent = d.pacingNotes; show('notesCard'); }
        if(d.result){
          document.getElementById('resultTxt').textContent = d.result;
          document.getElementById('feltTxt').textContent = d.felt || '';
          show('resultCard');
        } else {
          show('pendingCard');
        }
        show('content');
      }).catch(function(e){
        stateEl.hidden = true; show('errCard');
        document.getElementById('errTxt').textContent = 'Impossible de charger ce suivi pour le moment.';
        console.error(e);
      });
  }
})();