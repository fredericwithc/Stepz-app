function stepShotHtml(s){
  if(!s.shot) return '';
  const pos=s.shotPos?` style="object-position:${s.shotPos}"`:"";
  const view=s.shotImg
    ?`<img class="shot-img" src="${s.shotImg}" alt="${s.shot}" loading="lazy"${pos}>`
    :`<div class="shot-ph" aria-hidden="true">${s.shot}</div>`;
  return `<div class="shotcol sized"><div class="win"><div class="bar"><div class="dots"><i></i><i></i><i></i></div><div class="url">${s.url||'stepz.app'}</div></div><div class="view">${view}</div></div><span class="shotcap">print · ${s.shot}</span></div>`;
}
function stepHasShot(s){return !!(s.shot||s.shotImg)}
function stepBodyHtml(s){
  const paras=(Array.isArray(s.ps)?s.ps:[s.p]).filter(Boolean);
  return paras.map(t=>`<p>${t}</p>`).join('');
}
const STEPS=[
 {n:"01",name:"O ponto de partida",tag:"degrau 01 · o ponto de partida",h1:"Você já subiu mais<br>do que lembra.",ps:[
  "O app nasceu de uma percepção simples: a gente faz muita coisa e não percebe. A lista cresce, as demandas não param e mesmo quando você conclui algo, já apareceu uma coisa nova. No fim do dia, no fim da semana, parece que você não saiu do lugar. Mas saiu.",
  "O problema não é falta de esforço. É falta de registro. A nossa memória guarda apenas o peso do que ainda falta, não a leveza do que já passou. Você esquece as vitórias antes mesmo de comemorá-las.",
  "O Stepz existe pra corrigir isso. Cada tarefa que você conclui vira um degrau. Cada hábito mantido, mais um. Com o tempo, você olha pra trás e vê uma escada inteira que você mesmo construiu, sem nem ter percebido que estava construindo algo.",
  "É isso. Um tapinha no ombro todo dia. Uma lembrança de que tudo começa do zero, e que você já foi muito além disso."
 ],sky:"#0a0a0b",cta:1,solo:1},
 {n:"02",name:"A tela principal",tag:"degrau 02 · a tela principal",h2:"A escada é o espelho do que você construiu.",ps:[
  "A tela principal do Stepz é onde o seu dia começa. No topo, uma frase te recebe, inspiradora, acolhedora, o tipo de coisa que você lê e pensa \"era exatamente isso que eu precisava ouvir hoje.\" Logo abaixo, sua escada: cada degrau uma prova visual de tudo que você já concluiu.",
  "Dali você se organiza. Vê o que falta fazer, acompanha seus hábitos do dia, retoma o fio da meada. É o ponto de partida de uma rotina com mais clareza e menos aquela sensação de estar apagando incêndio o tempo todo.",
  "Você abre o app, vê o quanto já subiu, lê sua frase do dia e sabe exatamente por onde começar."
 ],sky:"#17162b",shot:"a escada em tela cheia",shotImg:"landing-shots/1.png",url:"stepz.app/inicio"},
 {n:"03",name:"Tarefas",tag:"degrau 03 · tarefas",h2:"Marcou. Virou degrau. Ficou para sempre.",ps:[
  "A aba de tarefas é onde a organização acontece de verdade. Você cria uma task, define a prioridade, coloca uma data, associa a um projeto e adiciona tags para encontrar tudo rápido depois. Simples de criar, poderoso de acompanhar.",
  "E tem um detalhe que faz diferença no dia a dia: tasks que se repetem. Aquela conta que vence todo mês, o lembrete que não pode sumir, a tarefa que faz parte da sua rotina, você configura uma vez e ela reaparece sozinha, sete dias antes do prazo, pronta pra ser concluída de novo. Sem precisar lembrar, sem precisar recriar.",
  "Cada task concluída vira um degrau na sua escada. E os degraus anteriores ficam, mesmo nas tarefas recorrentes, cada ciclo concluído fica registrado. Porque tudo que você fez importa, e nada deve desaparecer só porque você terminou."
 ],sky:"#131a2d",shot:"lista de tarefas do dia",shotImg:"landing-shots/2.png",url:"stepz.app/tarefas"},
 {n:"04",name:"Hábitos",tag:"degrau 04 · hábitos",h2:"Consistência não é disciplina. É identidade.",ps:[
  "Criar um hábito no Stepz leva dois segundos. Você digita o nome e clica no mais. Pronto. A partir daí, todo dia que você marcar conta um degrau e aparece no seu histórico semanal, uma fileira de quadradinhos que vai ficando colorida conforme você vai aparecendo.",
  "E quando você não aparece? Não tem notificação agressiva, não tem streak zerado na sua cara, não tem culpa. O Stepz não foi feito pra ser aquele relacionamento tóxico que fica te cobrando. Não deu hoje, tranquilo, amanhã você volta. O que importa é o acumulado, não a perfeição.",
  "Porque consistência de verdade não é fazer todos os dias sem falhar. É voltar toda vez que você parou. E o Stepz está sempre aqui quando você volta."
 ],sky:"#0f1d29",shot:"painel de hábitos",shotImg:"landing-shots/3.png",url:"stepz.app/habitos"},
 {n:"05",name:"Metas",tag:"degrau 05 · metas",h2:"Algumas conquistas não cabem em uma tarefa só.",ps:[
  "Tem coisa que não é do dia a dia. É do mês, do ano, talvez de anos. Uma viagem que você quer fazer, um peso que quer perder, uma habilidade que quer desenvolver. Essas coisas precisam de um espaço diferente, com um horizonte maior.",
  "Na aba de metas você define o objetivo, coloca uma data e cria marcos ao longo do caminho. Pequenas vitórias intermediárias que provam que você está se movendo na direção certa, mesmo quando o destino final ainda parece longe.",
  "A barra de progresso vai avançando conforme você conquista cada marco. E lá no topo, a contagem regressiva te lembra quanto tempo falta, sem pressão, só contexto. Você escolhe a cor da sua meta, ela aparece do jeito que é sua.",
  "Porque uma meta de verdade não é uma tarefa grande. É uma jornada."
 ],sky:"#0f2019",shot:"metas e marcos",shotImg:"landing-shots/4.png",url:"stepz.app/metas"},
 {n:"06",name:"Post-its",tag:"degrau 06 · post-its",h2:"O que não é tarefa também precisa de lugar.",ps:[
  "Tem informação que não é uma tarefa, não é uma meta, mas não pode sumir. O número do documento, o contato do piscineiro, a ideia que veio no banho, o lembrete que você vai precisar daqui a três meses. Essas coisas vivem em anotação de celular, em mensagem pra si mesmo, em papel colado na geladeira. E somem.",
  "No Stepz, elas ficam. Você cria um post-it, dá um nome, escolhe uma cor, organiza por categoria e adiciona tudo que precisar dentro dele. Contas da casa, contatos importantes, ideias em aberto, compras, eventos, links, dicas. Cada coisa no seu quadro, cada quadro no seu lugar.",
  "E quando precisar de algo, está lá. Não em cinco aplicativos diferentes, não numa conversa perdida no WhatsApp. No mesmo lugar onde está sua escada, suas tasks e seus hábitos. Tudo que é sua vida, em um só lugar."
 ],sky:"#13202e",shot:"quadro de post-its",shotImg:"landing-shots/5.png",url:"stepz.app/post-its"},
 {n:"07",name:"Jornada",tag:"degrau 07 · jornada",h2:"Tudo que você fez está aqui. Na ordem em que aconteceu.",ps:[
  "A aba Jornada é o arquivo vivo do que você construiu. Cada tarefa concluída, cada hábito marcado, cada degrau ganho, tudo registrado com data e hora. Você rola pra baixo e viaja no tempo, vendo exatamente o que fez ontem, semana passada, no mês anterior.",
  "É a tela que mais surpreende. Porque quando você olha o histórico de tudo que aconteceu, percebe que fez muito mais do que lembrava. Aquela sensação de estar parado simplesmente some.",
  "Conforme sua escada cresce, ela passa por patamares a cada dez degraus. Pequenos marcos que ficam registrados na sua jornada, provando que você chegou em outro lugar. Cada um é uma conquista que você carrega, degrau por degrau."
 ],sky:"#171331",cta:2,shot:"linha do tempo",shotImg:"landing-shots/6.png",url:"stepz.app/jornada"}
];
const cam=document.getElementById('cam'),rail=document.getElementById('rail'),track=document.getElementById('track'),walker=document.getElementById('walker'),sky=document.getElementById('sky'),altn=document.getElementById('altn'),hint=document.getElementById('hint');
let SW=0,SH=0,EX=0,PH=0,AX=0,AY=0;const TICK=46;
function dims(){const W=innerWidth,H=innerHeight;SW=Math.min(Math.max(W*.15,116),215);EX=Math.min(W*.82,1180);SH=Math.min(Math.max(H*.18,88),190);PH=W<1000?Math.min(Math.max(H*.84,380),H-72):Math.min(Math.max(H*.78,420),H-80);AX=W<1000?W*.07:W*.12;AY=H*.88}
dims();
cam.innerHTML=STEPS.map((s,i)=>`<div class="st${s.gold?' gold':''}${s.solo?' solo':''}${stepHasShot(s)?' has-shot':''}" id="st${i}"><div class="num">${String(i+1).padStart(2,'0')}</div><div class="name">${s.name}</div><div class="inner${stepHasShot(s)?' with-shot':''}"><div class="copy"><div class="tag"><i></i>${s.tag}</div>${s.h1?`<h1>${s.h1}</h1>`:`<h2>${s.h2}</h2>`}${stepBodyHtml(s)}${s.cta?`<div class="ctas"><a href="${s.cta===1?'app.html?mode=signup':'app.html'}" class="b1">${s.cta===1?'Começar grátis':'Construir o primeiro degrau'}</a>${s.cta===1?'<a href="#s1" class="b2">Ver como funciona</a>':'<a href="app.html" class="b2">Entrar</a>'}</div>`:''}</div>${stepShotHtml(s)}</div></div>`).join('');
rail.innerHTML=STEPS.map((s,i)=>`<a href="#s${i}" id="rl${i}">${s.n}<b></b></a>`).join('');
track.innerHTML=STEPS.map((s,i)=>`<div class="slot" id="s${i}"></div>`).join('');
const sts=STEPS.map((_,i)=>document.getElementById('st'+i)),rls=STEPS.map((_,i)=>document.getElementById('rl'+i));
const ruler=document.getElementById('ruler'),meters=document.getElementById('meters'),horizon=document.getElementById('horizon'),far=document.getElementById('far'),mid=document.getElementById('mid'),near=document.getElementById('near'),stars=document.getElementById('stars');
const legal=document.getElementById('legal'),legalYear=document.getElementById('legal-year');
if(legalYear) legalYear.textContent=String(new Date().getFullYear());
ruler.innerHTML=STEPS.map((s,i)=>`<div class="tk${i%2===0?' big':''}" style="top:${-i*TICK}px"><b></b><span>${i%2===0?String(i+1).padStart(2,'0'):''}</span></div>`).join('');
const ez=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
let landT=0;
const bump=(i,p)=>Math.max(0,1-Math.abs(p-i));
let cur=-1,lastY=-1,lastW=0,lastH=0;
const SHOT_AR=1332/942;
function sizeShots(){
  document.querySelectorAll('.shotcol.sized').forEach(col=>{
    const bar=col.querySelector('.bar');
    const cap=col.querySelector('.shotcap');
    const img=col.querySelector('.shot-img');
    const h=col.clientHeight;
    if(h<40) return;
    const ar=(img&&img.naturalWidth>0)?(img.naturalWidth/img.naturalHeight):SHOT_AR;
    const chrome=(bar?bar.offsetHeight:36)+(cap?cap.offsetHeight+10:28)+2;
    const imgH=Math.max(80,h-chrome);
    const want=Math.round(imgH*ar);
    const maxW=col.parentElement?Math.max(200,col.parentElement.clientWidth-200):want;
    col.style.width=Math.min(want,maxW)+'px';
  });
}
document.querySelectorAll('.shot-img').forEach(img=>{
  if(!img.complete) img.addEventListener('load',sizeShots,{once:true});
});
function frame(){
  const N=STEPS.length,p=Math.max(0,Math.min(N-1,scrollY/innerHeight));
  const fl=Math.min(N-1,Math.floor(p)),fr=p-fl,pe=fl+ez(fr);
  const w=[];for(let i=0;i<N;i++)w[i]=SW+EX*Math.max(0,1-Math.abs(pe-i));
  let x=0,camX=0;
  for(let i=0;i<N;i++){sts[i].style.left=(AX+x)+'px';sts[i].style.top=(AY-i*SH-PH)+'px';sts[i].style.height=PH+'px';sts[i].style.width=w[i]+'px';if(i<fl)camX+=w[i];x+=w[i]}
  camX+=ez(fr)*w[fl];
  cam.style.transform=`translate3d(${-camX}px,${pe*SH}px,0)`;
  far.style.transform=`translate3d(0,${pe*SH*.3}px,0)`;
  mid.style.transform=`translate3d(0,${pe*SH*.55}px,0)`;
  near.style.transform=`translate3d(0,${pe*SH*.8}px,0)`;
  horizon.style.top=AY+'px';horizon.style.transform=`translateY(${pe*SH*.45}px)`;
  ruler.style.transform=`translateY(${pe*TICK}px)`;
  stars.style.opacity=(.2+.62*(pe/(N-1))).toFixed(3);
  meters.textContent=(pe*.18).toFixed(2).replace('.',',')+' m';
  walker.style.left=(AX-26)+'px';walker.style.top=(AY-30)+'px';
  const i=Math.round(p);
  if(i!==cur){cur=i;sts.forEach((el,k)=>el.classList.toggle('on',k===i));rls.forEach((el,k)=>el.classList.toggle('on',k<=i));sky.style.backgroundColor=STEPS[i].sky;altn.textContent=String(i+1).padStart(2,'0');walker.classList.remove('land');void walker.offsetWidth;walker.classList.add('land');clearTimeout(landT);landT=setTimeout(()=>walker.classList.remove('land'),360);if(legal)legal.classList.toggle('on',i===N-1)}
  sizeShots();
  hint.classList.toggle('hide',scrollY>innerHeight*.35);
}
function tick(){if(innerWidth!==lastW||innerHeight!==lastH){lastW=innerWidth;lastH=innerHeight;dims();lastY=-1}if(scrollY!==lastY||lastY<0){lastY=scrollY;frame()}requestAnimationFrame(tick)}
requestAnimationFrame(tick);
let d='';for(let k=0;k<90;k++){d+=`<circle cx="${Math.random()*100}%" cy="${Math.random()*78}%" r="${Math.random()*1.3+.3}" fill="#fff" opacity="${Math.random()*.5+.15}"/>`}
document.getElementById('stars').innerHTML=d;
frame();
