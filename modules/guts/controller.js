/* GUTS · Get Up To Speed · v1.2.0 · MOD 09
   New in v1.2: image resize handles · System+Own voice RA
   per-context voice recording · voice selector · DOCX/PPTX fix */
import { $, esc, toast, downloadFile, pickFile } from '../../core/ui.js';
import { Storage } from '../../core/storage.js';
import { AI } from '../../core/ai.js';

const V = '1.2.0';
const SCOPE = Storage.scope('guts');

const P_STORY = 'You are a Deep English language teacher. Transform the given content into a rich story-style English learning lesson. Write 4-6 natural paragraphs (3-5 sentences each), engaging narrative voice, preserve all key facts, mix short and long sentences, intermediate learner level (Indian audience). Return ONLY the story text.';
const P_VOCAB = 'You are a Hindi-English vocabulary expert. Given a comma-separated list of English words, return ONLY valid JSON: {"word1":"हिंदी अर्थ","word2":"हिंदी अर्थ"}. 1-4 words per meaning. No markdown.';
const P_WORD  = 'You are an English vocabulary expert for Indian learners. For the word given return ONLY valid JSON: {"synonyms":["w1","w2","w3"],"sentences":["Sentence 1.","Sentence 2."],"devanagari":["देव1","देव2","देव3"]}. No markdown.';
const P_PDF   = 'You are a text reconstruction expert. This text was extracted from a PDF with possible column artifacts, broken lines, page numbers, headers. Reconstruct as clean readable prose. Return ONLY the clean text.';
const P_QUIZ  = 'You are an English comprehension teacher for Indian learners. Generate 3 MCQ from the text. Return ONLY valid JSON array: [{"q":"Question?","options":["a","b","c","d"],"answer":"a","explain":"Reason."}]. No markdown.';

/* ── Module-level data ────────────────────────────────────────── */
const HD = {
  fluency:'प्रवाह',fluent:'धाराप्रवाह',vocabulary:'शब्द भंडार',grammar:'व्याकरण',pronunciation:'उच्चारण',communicate:'संवाद करना',conversation:'बातचीत',expression:'अभिव्यक्ति',language:'भाषा',understand:'समझना',practice:'अभ्यास',improve:'सुधारना',learning:'सीखना',knowledge:'ज्ञान',lesson:'पाठ',sentence:'वाक्य',meaning:'अर्थ',translate:'अनुवाद करना',comprehend:'समझना',articulate:'स्पष्ट बोलना',eloquent:'वाक्पटु',bilingual:'द्विभाषी',interpret:'व्याख्या करना',narrate:'वर्णन करना',describe:'वर्णन करना',explain:'समझाना',define:'परिभाषित करना',clarify:'स्पष्ट करना',emphasize:'जोर देना',summarize:'सारांश देना',elaborate:'विस्तार करना',illustrate:'चित्रित करना',simplify:'सरल करना',paraphrase:'दूसरे शब्दों में',transcript:'लिखित प्रति',
  confidence:'आत्मविश्वास',motivation:'प्रेरणा',resilience:'लचीलापन',perspective:'दृष्टिकोण',imagination:'कल्पना',creativity:'रचनात्मकता',awareness:'जागरूकता',mindset:'मानसिकता',potential:'क्षमता',discipline:'अनुशासन',patience:'धैर्य',commitment:'प्रतिबद्धता',consistent:'लगातार',progress:'प्रगति',achievement:'उपलब्धि',success:'सफलता',failure:'विफलता',challenge:'चुनौती',opportunity:'अवसर',experience:'अनुभव',wisdom:'बुद्धिमानी',intelligence:'बुद्धि',intuition:'अंतर्ज्ञान',perception:'अनुभूति',curiosity:'जिज्ञासा',determination:'दृढ़ संकल्प',perseverance:'दृढ़ता',ambition:'महत्वाकांक्षा',aspiration:'आकांक्षा',inspiration:'प्रेरणा',transformation:'परिवर्तन',evolution:'विकास',adaptation:'अनुकूलन',innovation:'नवाचार',breakthrough:'सफलता',overcome:'पार करना',accomplish:'प्राप्त करना',strive:'प्रयास करना',pursue:'अनुसरण करना',dedicate:'समर्पित करना',focus:'ध्यान',concentrate:'केंद्रित करना',reflect:'विचार करना',contemplate:'चिंतन करना',analyze:'विश्लेषण करना',evaluate:'मूल्यांकन करना',prioritize:'प्राथमिकता',organize:'व्यवस्थित करना',
  philosophy:'दर्शनशास्त्र',psychology:'मनोविज्ञान',spirituality:'आध्यात्मिकता',principle:'सिद्धांत',strategy:'रणनीति',process:'प्रक्रिया',effective:'प्रभावी',efficient:'कुशल',essential:'आवश्यक',important:'महत्वपूर्ण',valuable:'मूल्यवान',meaningful:'सार्थक',significant:'महत्वपूर्ण',fundamental:'मूलभूत',determine:'निर्धारित करना',establish:'स्थापित करना',demonstrate:'प्रदर्शित करना',recognize:'पहचानना',appreciate:'सराहना करना',theory:'सिद्धांत',concept:'अवधारणा',hypothesis:'परिकल्पना',argument:'तर्क',evidence:'प्रमाण',analysis:'विश्लेषण',interpretation:'व्याख्या',conclusion:'निष्कर्ष',assumption:'धारणा',consequence:'परिणाम',pattern:'पैटर्न',structure:'संरचना',framework:'ढांचा',mechanism:'तंत्र',phenomenon:'घटना',complexity:'जटिलता',diversity:'विविधता',inclusion:'समावेश',sustainability:'स्थिरता',integrity:'ईमानदारी',
  happiness:'खुशी',sadness:'दुख',excitement:'उत्साह',enthusiasm:'उत्साह',passion:'जुनून',compassion:'करुणा',empathy:'सहानुभूति',gratitude:'कृतज्ञता',forgiveness:'क्षमा',hope:'आशा',loneliness:'अकेलापन',contentment:'संतोष',frustration:'निराशा',satisfaction:'संतुष्टि',pride:'गर्व',jealousy:'ईर्ष्या',admiration:'प्रशंसा',respect:'सम्मान',trust:'विश्वास',doubt:'संदेह',confusion:'भ्रम',surprise:'आश्चर्य',nostalgia:'पुरानी यादें',melancholy:'उदासी',serenity:'शांति',overwhelmed:'अभिभूत',motivated:'प्रेरित',curious:'जिज्ञासु',nervous:'घबराया',grateful:'कृतज्ञ',anxious:'चिंतित',joyful:'आनंदित',peaceful:'शांतिपूर्ण',restless:'बेचैन',
  achieve:'प्राप्त करना',believe:'विश्वास करना',consider:'विचार करना',develop:'विकसित करना',encourage:'प्रोत्साहित करना',facilitate:'सुगम करना',generate:'उत्पन्न करना',implement:'लागू करना',investigate:'जांच करना',justify:'उचित ठहराना',maintain:'बनाए रखना',negotiate:'बातचीत करना',observe:'देखना',participate:'भाग लेना',respond:'जवाब देना',support:'समर्थन करना',utilize:'उपयोग करना',validate:'मान्य करना',acquire:'प्राप्त करना',collaborate:'सहयोग करना',contribute:'योगदान देना',coordinate:'समन्वय करना',create:'बनाना',debate:'बहस करना',examine:'जांच करना',explore:'खोज करना',identify:'पहचानना',integrate:'एकीकृत करना',manage:'प्रबंधन करना',monitor:'निगरानी करना',motivate:'प्रेरित करना',perform:'प्रदर्शन करना',promote:'बढ़ावा देना',publish:'प्रकाशित करना',suggest:'सुझाना',teach:'सिखाना',transform:'बदलना',verify:'सत्यापित करना',
  accurate:'सटीक',authentic:'प्रामाणिक',brilliant:'शानदार',capable:'सक्षम',decisive:'निर्णायक',dedicated:'समर्पित',flexible:'लचीला',focused:'केंद्रित',generous:'उदार',genuine:'वास्तविक',humble:'विनम्र',innovative:'अभिनव',insightful:'अंतर्दृष्टिपूर्ण',logical:'तार्किक',objective:'वस्तुनिष्ठ',optimistic:'आशावादी',organized:'व्यवस्थित',persistent:'दृढ़',practical:'व्यावहारिक',proactive:'सक्रिय',productive:'उत्पादक',professional:'पेशेवर',reliable:'विश्वसनीय',responsible:'जिम्मेदार',sensitive:'संवेदनशील',sincere:'ईमानदार',skilled:'कुशल',strategic:'रणनीतिक',thoughtful:'विचारशील',versatile:'बहुमुखी',vibrant:'जीवंत',visionary:'दूरदर्शी',dynamic:'गतिशील',ethical:'नैतिक',
  moment:'पल',duration:'अवधि',century:'सदी',frequency:'आवृत्ति',distance:'दूरी',location:'स्थान',position:'स्थिति',direction:'दिशा',boundary:'सीमा',horizon:'क्षितिज',landscape:'परिदृश्य',territory:'क्षेत्र',atmosphere:'वातावरण',circumstance:'परिस्थिति',situation:'स्थिति',background:'पृष्ठभूमि',foundation:'नींव',origin:'उत्पत्ति',destination:'मंजिल',momentum:'गति',
  ecosystem:'पारिस्थितिकी',biodiversity:'जैव विविधता',conservation:'संरक्षण',climate:'जलवायु',geography:'भूगोल',wilderness:'जंगल',mountain:'पर्वत',river:'नदी',ocean:'महासागर',forest:'वन',season:'मौसम',rainfall:'वर्षा',temperature:'तापमान',organic:'जैविक',renewable:'नवीकरणीय',
  profession:'पेशा',career:'करियर',industry:'उद्योग',organization:'संगठन',management:'प्रबंधन',leadership:'नेतृत्व',productivity:'उत्पादकता',efficiency:'दक्षता',revenue:'राजस्व',investment:'निवेश',entrepreneurship:'उद्यमिता',technology:'प्रौद्योगिकी',marketing:'विपणन',partnership:'साझेदारी',deadline:'समय सीमा',feedback:'प्रतिक्रिया',performance:'प्रदर्शन',accountability:'जवाबदेही',transparency:'पारदर्शिता',governance:'शासन',compliance:'अनुपालन',implementation:'कार्यान्वयन',
  wellness:'स्वास्थ्य',nutrition:'पोषण',meditation:'ध्यान',mindfulness:'सजगता',therapy:'चिकित्सा',diagnosis:'निदान',treatment:'उपचार',prevention:'रोकथाम',recovery:'स्वास्थ्य लाभ',immunity:'प्रतिरक्षा',consciousness:'चेतना',relaxation:'विश्राम',vitality:'जीवन शक्ति',stamina:'सहनशक्ति',endurance:'धीरज',strength:'शक्ति',balance:'संतुलन',breathing:'श्वास',healing:'उपचार',longevity:'दीर्घायु',lifestyle:'जीवन शैली',
  relationship:'संबंध',friendship:'मित्रता',community:'समुदाय',society:'समाज',culture:'संस्कृति',tradition:'परंपरा',heritage:'विरासत',equality:'समानता',justice:'न्याय',democracy:'लोकतंत्र',freedom:'स्वतंत्रता',responsibility:'जिम्मेदारी',mentorship:'मार्गदर्शन',cooperation:'सहयोग',tolerance:'सहिष्णुता',celebration:'उत्सव',recognition:'पहचान',encouragement:'प्रोत्साहन',guidance:'मार्गदर्शन',
  platform:'मंच',strategy:'रणनीति',director:'निर्देशक',release:'रिलीज़',streaming:'स्ट्रीमिंग',content:'सामग्री',digital:'डिजिटल',global:'वैश्विक',market:'बाज़ार',company:'कंपनी',business:'व्यवसाय',production:'निर्माण',distribution:'वितरण',audience:'दर्शक',commercial:'व्यावसायिक',exclusive:'विशेष',original:'मूल',according:'अनुसार',upcoming:'आगामी',expected:'अपेक्षित',reported:'रिपोर्ट किया',announced:'घोषित',confirmed:'पुष्टि',signals:'संकेत',uncommon:'असामान्य',footprint:'उपस्थिति',blockbuster:'ब्लॉकबस्टर',filmmaker:'फिल्मनिर्माता',international:'अंतर्राष्ट्रीय',domestic:'घरेलू',theatrical:'थियेट्रिकल',franchise:'फ्रेंचाइज़',
};

const CW = new Set('the,be,to,of,and,a,in,that,have,it,for,not,on,with,he,as,you,do,at,this,but,his,by,from,they,we,say,her,she,or,an,will,my,one,all,would,there,their,what,so,up,out,if,about,who,get,which,go,me,when,make,can,like,time,no,just,him,know,take,people,into,year,your,good,some,could,them,see,other,than,then,now,look,only,come,its,over,think,also,back,after,use,two,how,our,work,first,well,way,even,new,want,because,any,these,give,day,most,need,often,hand,high,place,hold,turn,help,start,never,next,hard,open,seem,always,both,show,feel,long,those,old,face,tell,keep,every,find,much,still,though,should,where,does,around,three,small,set,put,end,another,right,big,too,many,before,must,through,under,little,being,while,become,already,against,without,same,different,however,between,might,going,great,here,were,been,used,said,each,more,very,made,such,once,away,down,film,films,was,are,has,had,its'.split(','));
const CP = ['get up to speed','bear in mind','keep in mind','on the other hand','in other words','as a result','for example','for instance','in addition','at the same time','in fact','as well as','more than ever','look forward to','take for granted','point of view','make a difference','come up with','put up with','at least','in order to','as long as','even though','in spite of','due to','according to','in terms of','take part in','make sure','find out','figure out','right away','after all','all of a sudden','once in a while','sooner or later','on the whole','as far as','in general','at first','to begin with','on top of that','as a matter of fact','in the long run','at the end of the day','when it comes to','in my opinion','based on','in contrast','get rid of','keep in touch','run out of','look up to','carry on','catch up','give up','move on','stand out','work out'];

/* ── Helpers ──────────────────────────────────────────────────── */
function gFmt(ts){return new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',year:'2-digit'}).format(new Date(ts));}
function gId(){return 'g'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);}
function gJSON(t){try{return JSON.parse(t.replace(/```json|```/g,'').trim());}catch{return null;}}
function sCls(s){return s==='done'?'s-done':s==='reading'?'s-reading':'s-unread';}
function sLbl(s){return s==='done'?'Done':s==='reading'?'Reading':'Unread';}
function wcnt(t){return (t.match(/\b\w+\b/g)||[]).length;}
function hindi(w){return HD[w]||SCOPE.get('ah.'+w,null)||'';}
async function sha256(t){var b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t));return Array.from(new Uint8Array(b)).map(function(x){return x.toString(16).padStart(2,'0');}).join('');}

/* ── Voice selection ──────────────────────────────────────────── */
function getVoice(){
  var saved=SCOPE.get('voice.uri',null);if(!saved)return null;
  var voices=window.speechSynthesis.getVoices();
  return voices.find(function(v){return v.voiceURI===saved;})||null;
}
function loadVoices(cb){
  var v=window.speechSynthesis.getVoices();
  if(v.length){cb(v);return;}
  window.speechSynthesis.onvoiceschanged=function(){cb(window.speechSynthesis.getVoices());};
}

/* ── Speech ───────────────────────────────────────────────────── */
var _spk=false,_pau=false,_rate=1.0,_sents=[],_idx=0,_spkCb=null;
var _raRefs={}; /* {ctx: {play,pause,stop}} for _raSync */

function speak(text,rate,cb){
  if(!('speechSynthesis' in window)){toast('Speech not supported');return;}
  stopSpeak();
  var ss=tokSents(strip(text));if(!ss.length)return;
  _sents=ss;_idx=0;_spk=true;_pau=false;_rate=rate||1;_spkCb=cb||null;_spkNext();
}
function _spkNext(){
  if(!_spk||_idx>=_sents.length){_spk=false;if(_spkCb)_spkCb(-1);_raSync();return;}
  if(_spkCb)_spkCb(_idx);
  var u=new SpeechSynthesisUtterance(_sents[_idx]);
  u.rate=_rate;
  var voice=getVoice();
  if(voice){u.voice=voice;u.lang=voice.lang;}else{u.lang='en-US';}
  u.onend=function(){_idx++;_spkNext();};
  u.onerror=function(){_idx++;_spkNext();};
  window.speechSynthesis.speak(u);_raSync();
}
function stopSpeak(){_spk=false;_pau=false;if('speechSynthesis' in window)window.speechSynthesis.cancel();if(_spkCb){_spkCb(-1);_spkCb=null;}_raSync();}
function _raSync(){
  Object.keys(_raRefs).forEach(function(ctx){
    var r=_raRefs[ctx];
    if(!r)return;
    var pl=document.getElementById('ra-play-'+ctx),pa=document.getElementById('ra-pause-'+ctx),st=document.getElementById('ra-stop-'+ctx);
    if(!pl)return;
    pl.disabled=_spk&&!_pau;pa.disabled=!_spk||_pau;st.disabled=!_spk;
    pl.textContent=_pau?'Resume':'Play';
  });
}
function strip(h){var d=document.createElement('div');d.innerHTML=h;return d.innerText||d.textContent||'';}

/* ── Recording ────────────────────────────────────────────────── */
var _recorder=null,_recChunks=[],_recTimer=null,_curAudio=null;

function getMime(){
  var types=['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus','audio/mp4'];
  for(var i=0;i<types.length;i++){if(typeof MediaRecorder!=='undefined'&&MediaRecorder.isTypeSupported(types[i]))return types[i];}
  return '';
}
async function startRec(key,onDone){
  if(_recorder)stopRec();
  try{
    var stream=await navigator.mediaDevices.getUserMedia({audio:true});
    var mime=getMime();
    _recorder=new MediaRecorder(stream,mime?{mimeType:mime}:{});
    _recChunks=[];
    _recorder.ondataavailable=function(e){if(e.data&&e.data.size>0)_recChunks.push(e.data);};
    _recorder.onstop=function(){
      var blob=new Blob(_recChunks,{type:_recorder.mimeType||'audio/webm'});
      var reader=new FileReader();
      reader.onload=function(){
        try{SCOPE.set(key,reader.result);}catch(e){toast('Storage full - recording not saved');}
        stream.getTracks().forEach(function(t){t.stop();});
        if(onDone)onDone();
      };
      reader.readAsDataURL(blob);
    };
    _recorder.start(200);
    _recTimer=setTimeout(function(){stopRec();},180000); /* 3 min limit */
    return true;
  }catch(e){toast('Microphone error: '+e.message);return false;}
}
function stopRec(){clearTimeout(_recTimer);if(_recorder&&_recorder.state!=='inactive'){_recorder.stop();}_recorder=null;}
function playRec(key,onEnd){
  var data=SCOPE.get(key,null);if(!data){toast('No recording saved - record first');return null;}
  if(_curAudio){_curAudio.pause();_curAudio=null;}
  _curAudio=new Audio(data);
  if(onEnd)_curAudio.addEventListener('ended',onEnd);
  _curAudio.play().catch(function(){toast('Cannot play recording');});
  return _curAudio;
}
function stopPlayback(){if(_curAudio){_curAudio.pause();_curAudio=null;}}
function hasRec(key){return !!SCOPE.get(key,null);}
function delRec(key){SCOPE.remove(key);}

/* ── Read-aloud bar builder ───────────────────────────────────── */
/* ctx: unique string (les, note, word+word_str)
   getSents: function returning array of sentences for TTS
   highlightFn: optional fn(idx) for chunk highlighting */
function createRA(container,ctx,recKey,getSents,highlightFn){
  var mode=_raMode; /* 'system' | 'own' */
  var isRecording=false;
  var recInterval=null;

  function render(){
    var html='<div class="guts-ra-bar">';
    html+='<div class="guts-ra-modes">';
    html+='<button class="guts-ra-mode-btn'+(mode!=='own'?' active':'')+'" id="ra-m-sys-'+ctx+'">System</button>';
    html+='<button class="guts-ra-mode-btn'+(mode==='own'?' active':'')+'" id="ra-m-own-'+ctx+'">My Voice</button>';
    html+='</div>';

    if(mode!=='own'){
      html+='<button class="guts-ra-btn" id="ra-play-'+ctx+'">Play</button>';
      html+='<button class="guts-ra-btn" id="ra-pause-'+ctx+'" disabled>Pause</button>';
      html+='<button class="guts-ra-btn" id="ra-stop-'+ctx+'" disabled>Stop</button>';
      html+='<div class="guts-ra-speeds">';
      [0.75,1,1.25,1.5].forEach(function(s){html+='<button class="guts-ra-speed'+(_rate===s?' active':'')+'" data-rate="'+s+'">'+s+'x</button>';});
      html+='</div>';
    }else{
      if(isRecording){
        html+='<button class="guts-ra-btn guts-rec-btn recording" id="ra-rec-stop-'+ctx+'">Stop</button>';
        html+='<span class="guts-rec-timer" id="ra-rec-t-'+ctx+'">0:00</span>';
      }else if(hasRec(recKey)){
        html+='<button class="guts-ra-btn" id="ra-rec-play-'+ctx+'">Play Mine</button>';
        html+='<button class="guts-ra-btn guts-rec-btn" id="ra-rec-start-'+ctx+'">Re-record</button>';
        html+='<button class="guts-ra-btn" style="color:var(--rust)" id="ra-rec-del-'+ctx+'">Delete</button>';
      }else{
        html+='<button class="guts-ra-btn guts-rec-btn" id="ra-rec-start-'+ctx+'">Record My Voice</button>';
        html+='<span class="guts-rec-hint">Record yourself reading this</span>';
      }
    }
    html+='</div>';
    container.innerHTML=html;
    bind();
  }

  function bind(){
    var sysBt=container.querySelector('#ra-m-sys-'+ctx);
    var ownBt=container.querySelector('#ra-m-own-'+ctx);
    if(sysBt)sysBt.addEventListener('click',function(){mode='system';_raMode=mode;render();});
    if(ownBt)ownBt.addEventListener('click',function(){mode='own';_raMode=mode;render();});

    if(mode!=='own'){
      /* System TTS controls */
      _raRefs[ctx]={play:true};
      var play=container.querySelector('#ra-play-'+ctx);
      var pause=container.querySelector('#ra-pause-'+ctx);
      var stop=container.querySelector('#ra-stop-'+ctx);
      if(play)play.addEventListener('click',function(){
        if(_pau){_pau=false;window.speechSynthesis.resume();_raSync();return;}
        speak(getSents().join(' '),_rate,function(idx){if(highlightFn)highlightFn(idx);});
      });
      if(pause)pause.addEventListener('click',function(){if(_pau){_pau=false;window.speechSynthesis.resume();}else{_pau=true;window.speechSynthesis.pause();}_raSync();});
      if(stop)stop.addEventListener('click',function(){stopSpeak();if(highlightFn)highlightFn(-1);});
      container.querySelectorAll('.guts-ra-speed').forEach(function(b){
        b.addEventListener('click',function(){
          _rate=parseFloat(b.dataset.rate);
          container.querySelectorAll('.guts-ra-speed').forEach(function(x){x.classList.remove('active');});
          b.classList.add('active');
          if(_spk){stopSpeak();setTimeout(function(){speak(getSents().join(' '),_rate,function(idx){if(highlightFn)highlightFn(idx);});},80);}
        });
      });
      _raSync();
    }else{
      /* Own voice controls */
      delete _raRefs[ctx];
      var stopBtn=container.querySelector('#ra-rec-stop-'+ctx);
      var playBtn=container.querySelector('#ra-rec-play-'+ctx);
      var startBtn=container.querySelector('#ra-rec-start-'+ctx);
      var delBtn=container.querySelector('#ra-rec-del-'+ctx);

      if(stopBtn){
        stopBtn.addEventListener('click',function(){
          clearInterval(recInterval);
          stopRec();
          isRecording=false;
          render();
          toast('Recording saved');
        });
      }
      if(playBtn){
        playBtn.addEventListener('click',function(){
          stopSpeak();
          playRec(recKey,function(){toast('Playback complete');});
        });
      }
      if(delBtn){
        delBtn.addEventListener('click',function(){
          if(!confirm('Delete your recording?'))return;
          delRec(recKey);render();
        });
      }
      if(startBtn){
        startBtn.addEventListener('click',async function(){
          var ok=await startRec(recKey,function(){
            clearInterval(recInterval);
            isRecording=false;
            render();
            toast('Recording saved');
          });
          if(ok){
            isRecording=true;render();
            var elapsed=0;
            recInterval=setInterval(function(){
              elapsed++;
              var tEl=container.querySelector('#ra-rec-t-'+ctx);
              if(tEl)tEl.textContent=Math.floor(elapsed/60)+':'+String(elapsed%60).padStart(2,'0');
              if(elapsed>=180){clearInterval(recInterval);stopRec();}
            },1000);
          }
        });
      }
    }
  }

  render();
}

/* ── Image controls in notes ──────────────────────────────────── */
function attachImgControls(rte,saveFn){
  var selectedWrapper=null;

  function deselectAll(){
    rte.querySelectorAll('.guts-img-wrapper').forEach(function(w){
      var img=w.querySelector('img');
      if(img)w.parentNode.insertBefore(img,w);
      w.remove();
    });
    selectedWrapper=null;
  }

  function selectImg(img){
    deselectAll();
    var wrapper=document.createElement('div');
    wrapper.className='guts-img-wrapper';
    wrapper.contentEditable='false';
    img.parentNode.insertBefore(wrapper,img);
    wrapper.appendChild(img);
    selectedWrapper=wrapper;

    /* Toolbar */
    var tb=document.createElement('div');
    tb.className='guts-img-toolbar';
    var dims=img.offsetWidth+'x'+img.offsetHeight;
    tb.innerHTML='<span class="guts-img-dims" id="img-dims">'+dims+'</span>'
      +'<button class="guts-img-btn" id="img-copy">Copy</button>'
      +'<button class="guts-img-btn danger" id="img-del">Delete</button>';
    wrapper.appendChild(tb);

    /* Four corner handles */
    var corners=[{cls:'nw',dir:-1},{cls:'ne',dir:1},{cls:'sw',dir:-1},{cls:'se',dir:1}];
    corners.forEach(function(cfg){
      var h=document.createElement('div');
      h.className='guts-img-handle '+cfg.cls;
      wrapper.appendChild(h);

      function startDrag(startX){
        var origW=img.offsetWidth;
        function onMove(cx){
          var dx=(cx-startX)*cfg.dir;
          var newW=Math.max(50,Math.min(900,origW+dx));
          img.style.width=newW+'px';
          img.style.height='auto';
          var el=document.getElementById('img-dims');
          if(el)el.textContent=newW+'x'+img.offsetHeight;
        }
        function onUp(){
          document.removeEventListener('mousemove',mm);document.removeEventListener('mouseup',mu);
          document.removeEventListener('touchmove',tm);document.removeEventListener('touchend',tu);
          saveFn();
        }
        var mm=function(e){onMove(e.clientX);};
        var mu=function(){onUp();};
        var tm=function(e){e.preventDefault();onMove(e.touches[0].clientX);};
        var tu=function(){onUp();};
        document.addEventListener('mousemove',mm);document.addEventListener('mouseup',mu);
        document.addEventListener('touchmove',tm,{passive:false});document.addEventListener('touchend',tu);
      }

      h.addEventListener('mousedown',function(e){e.preventDefault();e.stopPropagation();startDrag(e.clientX);});
      h.addEventListener('touchstart',function(e){e.preventDefault();e.stopPropagation();startDrag(e.touches[0].clientX);},{passive:false});
    });

    /* Toolbar button handlers */
    tb.querySelector('#img-del').addEventListener('click',function(e){
      e.stopPropagation();
      if(!confirm('Delete this image?'))return;
      wrapper.remove();selectedWrapper=null;saveFn();
    });
    tb.querySelector('#img-copy').addEventListener('click',function(e){
      e.stopPropagation();
      if(navigator.clipboard&&window.ClipboardItem){
        fetch(img.src).then(function(r){return r.blob();}).then(function(blob){
          navigator.clipboard.write([new ClipboardItem({[blob.type]:blob})]).then(function(){toast('Image copied to clipboard');}).catch(function(){toast('Long-press image to copy');});
        }).catch(function(){toast('Copy failed');});
      }else{toast('Long-press image to copy');}
    });
  }

  function onClick(e){
    if(e.target.closest('.guts-img-toolbar')||e.target.closest('.guts-img-handle'))return;
    if(e.target.tagName==='IMG'&&rte.contains(e.target)&&!e.target.closest('.guts-img-toolbar')){
      selectImg(e.target);
    }else if(!e.target.closest('.guts-img-wrapper')){
      deselectAll();
    }
  }

  rte.addEventListener('click',onClick);

  return function cleanup(){
    rte.removeEventListener('click',onClick);
    deselectAll();
  };
}

/* ── File readers ─────────────────────────────────────────────── */
async function readFile(file){
  var n=file.name.toLowerCase();
  if(n.endsWith('.pdf'))return readPdf(file);
  if(n.endsWith('.docx'))return readDocx(file);
  if(n.endsWith('.pptx'))return readPptx(file);
  if(n.endsWith('.vtt'))return readVtt(await file.text());
  if(n.endsWith('.srt'))return readSrt(await file.text());
  try{return await file.text();}catch(e){throw new Error('Cannot read '+file.name);}
}
async function readPdf(file){
  var lib=window.pdfjsLib;if(!lib)throw new Error('PDF.js not loaded - reload the app');
  lib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  var buf=await file.arrayBuffer(),pdf=await lib.getDocument({data:buf}).promise;
  var pages=[];
  for(var i=1;i<=pdf.numPages;i++){
    var page=await pdf.getPage(i),content=await page.getTextContent();
    var items=content.items.filter(function(it){return it.str.trim();});if(!items.length)continue;
    var xs=items.map(function(it){return it.transform[4];});
    var mid=(Math.min.apply(null,xs)+Math.max.apply(null,xs))/2;
    var left=items.filter(function(it){return it.transform[4]<mid;}).map(function(it){return it.str;}).join(' ');
    var right=items.filter(function(it){return it.transform[4]>=mid;}).map(function(it){return it.str;}).join(' ');
    pages.push((left.length>50&&right.length>50)?left+'\n\n'+right:items.map(function(it){return it.str;}).join(' '));
  }
  return pages.join('\n\n').trim();
}
async function readDocx(file){
  var Z=window.JSZip;if(!Z)throw new Error('JSZip not loaded - check index.html has JSZip CDN');
  var zip=await Z.loadAsync(file);
  var xml=await zip.file('word/document.xml').async('text');
  return xml.replace(/<w:br[^>]*>/gi,'\n').replace(/<\/w:p>/gi,'\n').replace(/<[^>]+>/g,'')
    .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\n{3,}/g,'\n\n').trim();
}
async function readPptx(file){
  var Z=window.JSZip;if(!Z)throw new Error('JSZip not loaded - check index.html has JSZip CDN');
  var zip=await Z.loadAsync(file);
  var slides=Object.keys(zip.files).filter(function(n){return /^ppt\/slides\/slide\d+\.xml$/.test(n);}).sort();
  var text='';
  for(var i=0;i<slides.length;i++){
    var xml=await zip.files[slides[i]].async('text');
    var t=xml.replace(/<a:t>/g,' ').replace(/<a:p[^>]*>/g,'\n').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
    if(t)text+=t+'\n\n';
  }
  return text.trim();
}
function readVtt(r){return r.split('\n').filter(function(l){return !l.match(/^WEBVTT|^\d+$|-->/);}).join(' ').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();}
function readSrt(r){return r.replace(/^\d+\s*$/gm,'').replace(/\d{2}:\d{2}:\d{2},\d+\s*-->\s*\d{2}:\d{2}:\d{2},\d+/g,'').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();}

/* ── AI ───────────────────────────────────────────────────────── */
async function aiStory(text){
  if(!AI.hasAnyRoute())return text;
  try{
    if(wcnt(text)>800){
      var paras=text.split(/\n\n+/).filter(function(p){return p.trim().length>20;}),h=Math.ceil(paras.length/2);
      var a=await AI.chat([{role:'system',content:P_STORY},{role:'user',content:paras.slice(0,h).join('\n\n')}],{maxTokens:900});
      var b=await AI.chat([{role:'system',content:P_STORY},{role:'user',content:paras.slice(h).join('\n\n')}],{maxTokens:900});
      return a.text+'\n\n'+b.text;
    }
    var r=await AI.chat([{role:'system',content:P_STORY},{role:'user',content:text}],{maxTokens:1200});
    return r.text||text;
  }catch(e){return text;}
}
async function aiCleanPdf(text){
  if(!AI.hasAnyRoute())return text;
  var lines=text.split('\n').filter(function(l){return l.trim().length>0;});
  if(lines.filter(function(l){return l.trim().length<45;}).length/Math.max(lines.length,1)<0.55)return text;
  try{
    var words=text.split(/\s+/),chunks=[];
    for(var i=0;i<words.length;i+=300)chunks.push(words.slice(i,i+300).join(' '));
    var out=[];
    for(var j=0;j<chunks.length;j++){var r=await AI.chat([{role:'system',content:P_PDF},{role:'user',content:chunks[j]}],{maxTokens:600});out.push(r.text);}
    return out.join('\n\n');
  }catch(e){return text;}
}
async function autoHindi(lesson){
  if(!AI.hasAnyRoute())return;
  var miss=lesson.allVocab.filter(function(w){return !HD[w]&&!SCOPE.get('ah.'+w,null);});
  if(!miss.length)return;
  var batches=[];for(var i=0;i<miss.length;i+=20)batches.push(miss.slice(i,i+20));
  for(var j=0;j<batches.length;j++){
    try{
      var r=await AI.chat([{role:'system',content:P_VOCAB},{role:'user',content:batches[j].join(', ')}],{maxTokens:400});
      var d=gJSON(r.text);
      if(d)Object.entries(d).forEach(function(e){if(e[0]&&e[1])SCOPE.set('ah.'+e[0].toLowerCase(),String(e[1]));});
    }catch(e){}
  }
}
async function enrichWord(word){
  var key='wc.'+word.toLowerCase();var cached=SCOPE.get(key,null);if(cached)return cached;
  if(!AI.hasAnyRoute())return null;
  try{var r=await AI.chat([{role:'system',content:P_WORD},{role:'user',content:word}],{maxTokens:300});var d=gJSON(r.text);if(d&&d.synonyms){SCOPE.set(key,d);return d;}return null;}catch(e){return null;}
}
async function aiQuiz(lt){
  if(!AI.hasAnyRoute())return staticQuiz(lt);
  try{var r=await AI.chat([{role:'system',content:P_QUIZ},{role:'user',content:lt.slice(0,2000)}],{maxTokens:700});var q=gJSON(r.text);if(Array.isArray(q)&&q.length)return q;return staticQuiz(lt);}catch(e){return staticQuiz(lt);}
}
function staticQuiz(text){
  var vocab=[...new Set((text.match(/\b[a-zA-Z]{7,}\b/g)||[]).filter(function(w){return !CW.has(w.toLowerCase());}).map(function(w){return w.toLowerCase();}))].slice(0,8);
  var sents=tokSents(text);var qs=[];
  for(var i=0;i<sents.length&&qs.length<3;i++){
    var sent=sents[i];var word=vocab.find(function(w){return sent.toLowerCase().includes(w);});
    if(word&&(sent.match(/\b\w+\b/g)||[]).length>=6){
      var bl=sent.replace(new RegExp('\\b'+word+'\\b','gi'),'_____');
      var wrong=vocab.filter(function(w){return w!==word;}).slice(0,3);
      if(!wrong.length)continue;
      var opts=[word].concat(wrong).sort(function(){return Math.random()-.5;}).slice(0,4);
      qs.push({q:bl,options:opts,answer:word,explain:'"'+word+'" fits.'});
    }
  }
  return qs;
}

/* ── Text processor ───────────────────────────────────────────── */
function procText(raw,title){var clean=cleanTxt(raw);var chunks=splitChunks(clean).map(mkChunk);return mkLesson(chunks,title||autoTitle(clean));}
function cleanTxt(raw){return raw.replace(/\[?\d{1,2}:\d{2}(?::\d{2})?\]?\s*/g,'').replace(/^[A-Z][A-Za-z\s]{0,25}:\s*/gm,'').replace(/<[^>]+>/g,' ').replace(/[ \t]+/g,' ').replace(/\r\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();}
function splitChunks(text){var p=text.split(/\n\n+/).map(function(x){return x.replace(/\n/g,' ').trim();}).filter(function(x){return x.length>30;});if(p.length>=2)return p;var s=tokSents(text),out=[];for(var i=0;i<s.length;i+=3){var c=s.slice(i,i+3).join(' ').trim();if(c.length>20)out.push(c);}return out.length?out:[text];}
function tokSents(text){return text.replace(/([.!?])\s+(?=[A-Z"'])/g,'$1|||').split('|||').map(function(s){return s.trim();}).filter(function(s){return s.length>8;});}
function mkChunk(rawText){var t=String(rawText||'');var sentences=tokSents(t),words=t.match(/\b[a-zA-Z]+\b/g)||[];var patterns=sentences.filter(function(s){return (s.match(/\b\w+\b/g)||[]).length>=12;});var vocab=[...new Set(words.filter(function(w){return w.length>=7&&!CW.has(w.toLowerCase());}).map(function(w){return w.toLowerCase();}))].slice(0,10);var lower=t.toLowerCase(),phrases=CP.filter(function(p){return lower.includes(p);});return {text:t,sentences:sentences,patterns:patterns,vocab:vocab,phrases:phrases};}
function mkLesson(chunks,title){return{id:'les_'+gId(),title:title,createdAt:Date.now(),status:'unread',chunks:chunks,allVocab:[...new Set(chunks.flatMap(function(c){return c.vocab;}))],allPhrases:[...new Set(chunks.flatMap(function(c){return c.phrases;}))],allPatterns:chunks.flatMap(function(c){return c.patterns;}),questions:[]};}
function autoTitle(text){var f=tokSents(text)[0]||text;return f.slice(0,60).trim()+(f.length>60?'...':'');}

function renderWords(text,wb,know){
  if(!text||typeof text!=='string')return '';
  return text.replace(/\b([a-zA-Z]+)\b/g,function(m){
    var k=m.toLowerCase(),hi=hindi(k),sv=wb.has(k),kn=know[k];
    return '<span class="gw'+(hi?' known':'')+(sv?' saved':'')+(kn&&kn.count>2?' freq':'')+'" data-word="'+k+'">'+esc(m)+'</span>';
  });
}

/* ── Knowledge ────────────────────────────────────────────────── */
function updateKnow(words,src){var k=SCOPE.get('knowledge',{});var now=Date.now();words.forEach(function(w){var key=w.toLowerCase();var prev=k[key]||{word:key,count:0,sourceIds:[],firstSeen:now,lastSeen:now};k[key]={...prev,count:prev.count+1,lastSeen:now,sourceIds:[...new Set([...(prev.sourceIds||[]),src])]};});SCOPE.set('knowledge',k);}

/* ── Data helpers ─────────────────────────────────────────────── */
var gL=function(){return SCOPE.get('lessons',[]);};
var gW=function(){return SCOPE.get('wordbank',[]);};
var gN=function(){return SCOPE.get('notes',[]);};
var gK=function(){return SCOPE.get('knowledge',{});};
function sL(l){SCOPE.set('lessons',[l].concat(gL().filter(function(x){return x.id!==l.id;})));}
function dL(id){SCOPE.set('lessons',gL().filter(function(l){return l.id!==id;}));}
function sW(w){SCOPE.set('wordbank',[w].concat(gW().filter(function(x){return x.id!==w.id;})));}
function dW(id){SCOPE.set('wordbank',gW().filter(function(w){return w.id!==id;}));}
function sN(n){SCOPE.set('notes',[...gN().filter(function(x){return x.id!==n.id;}),n].sort(function(a,b){return a.pageNum-b.pageNum;}));}
function dN(id){SCOPE.set('notes',gN().filter(function(n){return n.id!==id;}));}

/* ═══════════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════════ */
export default async function init({root,module:mod}){

  var elGate=root.querySelector('#guts-gate');
  var elMain=root.querySelector('#guts-main');
  var elC=root.querySelector('#guts-content');
  var elAI=root.querySelector('#guts-ai-status');
  var popup=root.querySelector('#guts-word-popup');

  var tab=SCOPE.get('tab','home'),lessonId=null,noteId=null,drillMode=false,saveTimer=null,fontIdx=1,autoMode=false;
  var _imgCleanup=null; /* cleanup fn for image controls */

  function setAI(){if(!elAI)return;var on=AI.hasAnyRoute();elAI.textContent=on?'AI ON':'AI OFF';elAI.className='mono'+(on?' guts-ai-on':' guts-ai-off');}

  /* ── PIN ────────────────────────────────────────────────────── */
  var pinEntry='',pinTries=0,pinLocked=false,pinMode='',setup1='';
  function getHash(){return SCOPE.get('pinHash',null);}function hasPin(){return !!getHash();}
  function initGate(){
    pinEntry='';pinMode=hasPin()?'verify':'setup-1';
    var lbl=root.querySelector('#guts-gate-label'),sub=root.querySelector('#guts-gate-sub'),rr=root.querySelector('#guts-pin-reset-row');
    if(!hasPin()){if(lbl)lbl.textContent='SET A 6-DIGIT PASSWORD';if(sub)sub.textContent='FIRST TIME SETUP';if(rr)rr.classList.add('hide');}
    else{if(lbl)lbl.textContent='ENTER 6-DIGIT PASSWORD';if(sub)sub.textContent='ENTER PASSWORD';if(rr)rr.classList.remove('hide');}
    dotSync();
  }
  function dotSync(){root.querySelectorAll('#guts-pin-dots .pin-dot').forEach(function(d,i){d.classList.toggle('filled',i<pinEntry.length);d.classList.toggle('active',i===pinEntry.length);});}
  async function digit(n){if(pinLocked||pinEntry.length>=6)return;var err=root.querySelector('#guts-pin-error');if(err)err.textContent='';pinEntry+=n;dotSync();if(pinEntry.length===6)await checkPin();}
  async function checkPin(){
    var err=root.querySelector('#guts-pin-error');var hash=await sha256(pinEntry);
    if(pinMode==='setup-1'){setup1=hash;pinMode='setup-2';var lbl=root.querySelector('#guts-gate-label');if(lbl)lbl.textContent='CONFIRM YOUR PASSWORD';pinEntry='';dotSync();return;}
    if(pinMode==='setup-2'){if(hash!==setup1){if(err)err.textContent='Passwords do not match';pinEntry='';dotSync();return;}SCOPE.set('pinHash',hash);unlock();return;}
    if(hash===getHash()){pinTries=0;unlock();}
    else{pinTries++;pinEntry='';dotSync();if(pinTries>=3){pinLocked=true;if(err)err.textContent='Too many attempts - wait 30s';setTimeout(function(){pinLocked=false;pinTries=0;if(err)err.textContent='';},30000);}else{if(err)err.textContent='Wrong ('+(3-pinTries)+' left)';}}
  }
  function unlock(){elGate.classList.add('hide');elMain.classList.remove('hide');setAI();route(tab);}
  function lock(){stopSpeak();stopPlayback();if(_imgCleanup){_imgCleanup();_imgCleanup=null;}elMain.classList.add('hide');elGate.classList.remove('hide');clearTimeout(saveTimer);pinEntry='';pinTries=0;_raRefs={};initGate();}

  root.querySelectorAll('#guts-numpad .num-btn[data-n]').forEach(function(btn){btn.addEventListener('click',function(){digit(btn.dataset.n);});});
  var okBtn=root.querySelector('#guts-pin-ok');if(okBtn)okBtn.addEventListener('click',async function(){if(pinEntry.length===6)await checkPin();});
  var clrBtn=root.querySelector('#guts-pin-clear');if(clrBtn)clrBtn.addEventListener('click',function(){pinEntry=pinEntry.slice(0,-1);dotSync();});
  var rstBtn=root.querySelector('#guts-pin-reset');if(rstBtn)rstBtn.addEventListener('click',function(){if(!confirm('Reset password? All GUTS data will be deleted.'))return;['pinHash','lessons','wordbank','notes','knowledge'].forEach(function(k){SCOPE.remove(k);});initGate();toast('Password reset');});
  var lkBtn=root.querySelector('#guts-lock-btn');if(lkBtn)lkBtn.addEventListener('click',lock);
  root.querySelectorAll('.guts-tab').forEach(function(btn){btn.addEventListener('click',function(){route(btn.dataset.tab);});});

  /* popup buttons */
  if(popup){
    popup.querySelector('#gwp-close').addEventListener('click',function(){popup.classList.add('hide');});
    popup.querySelector('#gwp-listen').addEventListener('click',function(){var w=popup.querySelector('#gwp-word').dataset.word;if(w)speak(w,_rate);});
    popup.querySelector('#gwp-save').addEventListener('click',function(){
      var w=popup.querySelector('#gwp-word').dataset.word;if(!w)return;
      var les=gL().find(function(l){return l.id===lessonId;});
      sW({id:'w_'+gId(),word:w,hindi:hindi(w),example:findEx(les,w),savedAt:Date.now(),lastReviewed:Date.now()});
      popup.querySelector('#gwp-save').textContent='Saved';popup.querySelector('#gwp-save').disabled=true;toast('Saved to word bank');
    });
    popup.querySelector('#gwp-enrich-btn').addEventListener('click',async function(){
      var w=popup.querySelector('#gwp-word').dataset.word;if(!w)return;
      var btn=popup.querySelector('#gwp-enrich-btn');btn.textContent='...';btn.disabled=true;
      var data=await enrichWord(w);
      if(data){
        popup.querySelector('#gwp-synonyms').innerHTML='<div>'+data.synonyms.join(' | ')+'</div>'+data.sentences.map(function(s){return '<div style="color:var(--muted);font-size:10px;margin-top:3px;font-style:italic">'+esc(s)+'</div>';}).join('');
        popup.querySelector('#gwp-deva').textContent=data.devanagari.join(' | ');
        btn.textContent='Done';
      }else{btn.textContent='No AI route';}
    });
  }

  initGate();

  /* ── Route ────────────────────────────────────────────────── */
  function route(t){
    tab=t;SCOPE.set('tab',t);stopSpeak();stopPlayback();
    if(_imgCleanup){_imgCleanup();_imgCleanup=null;}
    root.querySelectorAll('.guts-tab').forEach(function(b){b.classList.toggle('active',b.dataset.tab===t);});
    if(t==='upload')renderUpload();
    else if(t==='library')renderLibrary();
    else if(t==='lesson')renderLesson();
    else if(t==='words')renderWordBank();
    else if(t==='notes')renderNotes();
    else if(t==='transfer')renderTransfer();
    else renderHome();
  }

  /* ── HOME ────────────────────────────────────────────────── */
  function renderHome(){
    var ls=gL(),wb=gW(),unread=ls.filter(function(l){return l.status==='unread';}).length,done=ls.filter(function(l){return l.status==='done';}).length;
    var sevenD=7*24*60*60*1000,rev=wb.filter(function(w){return (Date.now()-(w.lastReviewed||w.savedAt))>sevenD;});
    var latest=ls.find(function(l){return l.status!=='done';})||ls[0];
    var html='<div class="guts-stats"><div class="guts-stat"><span class="guts-stat__n">'+ls.length+'</span><span class="guts-stat__l">Lessons</span></div><div class="guts-stat"><span class="guts-stat__n">'+unread+'</span><span class="guts-stat__l">Unread</span></div><div class="guts-stat"><span class="guts-stat__n">'+done+'</span><span class="guts-stat__l">Done</span></div><div class="guts-stat"><span class="guts-stat__n">'+wb.length+'</span><span class="guts-stat__l">Words</span></div></div>';
    if(rev.length)html+='<div class="guts-review-banner" id="h-rev"><span>Repeat</span><span><strong>'+rev.length+' word'+(rev.length>1?'s':'')+'</strong> ready for review</span><span class="guts-review-banner__arrow">-&gt;</span></div>';
    if(latest)html+='<div class="guts-section">Continue reading</div><div class="guts-lesson-card featured" id="h-latest"><div class="guts-lesson-card__status '+sCls(latest.status)+'">'+sLbl(latest.status)+'</div><div class="guts-lesson-card__title">'+esc(latest.title)+'</div><div class="guts-lesson-card__meta">'+latest.chunks.length+' chunks | '+latest.allVocab.length+' vocab | '+gFmt(latest.createdAt)+'</div><div class="guts-lesson-card__arrow">-&gt;</div></div>';
    else html+='<div class="guts-empty"><div class="guts-empty__icon">📖</div>No lessons yet - upload some material</div>';
    html+='<div class="guts-section" style="margin-top:20px">Quick actions</div><div class="guts-actions"><button class="guts-action-btn" id="ha-up"><span class="guts-action-btn__icon">⬆</span>Upload</button><button class="guts-action-btn" id="ha-lib"><span class="guts-action-btn__icon">📚</span>Library</button><button class="guts-action-btn" id="ha-wb"><span class="guts-action-btn__icon">💡</span>Words</button><button class="guts-action-btn" id="ha-n"><span class="guts-action-btn__icon">📝</span>Notes</button></div>';
    elC.innerHTML=html;
    elC.querySelector('#ha-up').addEventListener('click',function(){route('upload');});
    elC.querySelector('#ha-lib').addEventListener('click',function(){route('library');});
    elC.querySelector('#ha-wb').addEventListener('click',function(){route('words');});
    elC.querySelector('#ha-n').addEventListener('click',function(){route('notes');});
    var rb=elC.querySelector('#h-rev');if(rb)rb.addEventListener('click',function(){route('words');});
    var lb=elC.querySelector('#h-latest');if(lb)lb.addEventListener('click',function(){lessonId=latest.id;route('lesson');});
  }

  /* ── UPLOAD ──────────────────────────────────────────────── */
  function renderUpload(){
    var aiOn=AI.hasAnyRoute();
    var html='<label class="guts-label">Lesson title (optional)</label><input type="text" id="g-ul-title" class="guts-input" placeholder="Leave blank to auto-generate" maxlength="80">';
    html+='<div class="guts-mode-row"><div class="guts-mode-label">Processing mode</div><div class="guts-mode-btns"><button class="guts-mode-btn'+(autoMode?'':' active')+'" id="um-manual">Manual</button><button class="guts-mode-btn'+(autoMode?' active':'')+'" id="um-auto"'+(aiOn?'':' disabled')+'>Auto Story'+(aiOn?'':' (needs AI)')+'</button></div>'+(autoMode&&aiOn?'<div class="guts-mode-hint">AI will rewrite as Deep English story</div>':'')+'</div>';
    html+='<div class="guts-upload-tabs"><button class="guts-upload-tab active" id="ut-paste">Paste text</button><button class="guts-upload-tab" id="ut-file">Upload file</button></div>';
    html+='<div id="up-paste"><label class="guts-label">Any English text<span> article | transcript | story</span></label><textarea class="guts-textarea" id="g-paste" rows="9" placeholder="Paste your text here..."></textarea><div class="guts-row" style="margin-top:6px"><button class="btn btn-primary" id="g-proc-paste">Process and Save</button><span style="font-size:9px;color:var(--dim);align-self:center" id="g-paste-cc">0 chars</span></div></div>';
    html+='<div id="up-file" class="hide"><label class="guts-label">Pick any file<span> PDF | DOCX | PPTX | TXT | VTT | SRT</span></label><div class="guts-dropzone" id="g-dz"><span style="font-size:32px">📄</span><span class="guts-dropzone__label">Tap to pick a file</span><span class="guts-dropzone__hint">PDF | Word | PowerPoint | Text | Subtitles</span></div><div id="g-staging" class="hide"></div></div>';
    html+='<div id="g-proc-status" class="hide" style="margin-top:10px;font-size:11px;color:var(--lime);display:flex;align-items:center;gap:8px"><span class="guts-spinner">◐</span><span id="g-proc-msg">Processing...</span></div>';
    elC.innerHTML=html;bindUpload();
  }

  function bindUpload(){
    elC.querySelector('#um-manual').addEventListener('click',function(){autoMode=false;renderUpload();});
    elC.querySelector('#um-auto').addEventListener('click',function(){if(!AI.hasAnyRoute()){toast('Set an API key in Settings first');return;}autoMode=true;renderUpload();});
    elC.querySelector('#ut-paste').addEventListener('click',function(e){e.currentTarget.classList.add('active');elC.querySelector('#ut-file').classList.remove('active');elC.querySelector('#up-paste').classList.remove('hide');elC.querySelector('#up-file').classList.add('hide');});
    elC.querySelector('#ut-file').addEventListener('click',function(e){e.currentTarget.classList.add('active');elC.querySelector('#ut-paste').classList.remove('active');elC.querySelector('#up-file').classList.remove('hide');elC.querySelector('#up-paste').classList.add('hide');});
    var ta=elC.querySelector('#g-paste'),cc=elC.querySelector('#g-paste-cc');
    ta.addEventListener('input',function(){cc.textContent=ta.value.length.toLocaleString()+' chars';});
    elC.querySelector('#g-proc-paste').addEventListener('click',async function(){var text=ta.value.trim(),title=elC.querySelector('#g-ul-title').value.trim();if(text.length<30){toast('Paste at least 30 characters');return;}await runProc(text,title);});
    var _ft='',_ff=null;
    var dz=elC.querySelector('#g-dz'),staging=elC.querySelector('#g-staging');
    dz.addEventListener('click',async function(){
      var file=await pickFile('*/*');if(!file)return;
      setMsg(true,'Reading file...');
      try{var raw=await readFile(file);if(file.name.toLowerCase().endsWith('.pdf')){setMsg(true,'Cleaning PDF...');raw=await aiCleanPdf(raw);}_ft=raw;_ff=file;showStaging(file,raw,staging);}
      catch(e){toast('Could not read file: '+e.message);}
      finally{setMsg(false);}
    });

    function showStaging(file,text,el){
      var words=wcnt(text),small=words<500,isPdf=file.name.toLowerCase().endsWith('.pdf');
      el.classList.remove('hide');
      var h='<div class="guts-staging"><div class="guts-staging__header"><div class="guts-staging__name">'+esc(file.name)+'</div><div class="guts-staging__meta">'+words.toLocaleString()+' words | '+(small?'small file':'large file - pick how to use')+'</div></div>';
      h+='<pre class="guts-staging__preview">'+esc(text.slice(0,350))+(text.length>350?'\n...':'')+'</pre>';
      h+='<div class="guts-staging__actions">';
      if(small)h+='<button class="btn btn-primary" id="st-direct">Process to Library</button>';
      h+='<button class="btn" id="st-paste">Use in Paste</button>';
      if(isPdf)h+='<button class="btn" id="st-browser">Open PDF in Browser</button>';
      h+='<button class="btn btn-ghost" id="st-view">View full text</button>';
      if(!small)h+='<button class="btn btn-primary" id="st-direct">Process to Library</button>';
      h+='</div></div>';
      el.innerHTML=h;
      var sd=el.querySelector('#st-direct');if(sd)sd.addEventListener('click',function(){runProc(_ft,elC.querySelector('#g-ul-title')&&elC.querySelector('#g-ul-title').value.trim()||'');});
      el.querySelector('#st-paste').addEventListener('click',function(){elC.querySelector('#ut-paste').click();var ta2=elC.querySelector('#g-paste');if(ta2){ta2.value=_ft;ta2.dispatchEvent(new Event('input'));}toast('Text loaded into paste area');});
      if(isPdf)el.querySelector('#st-browser').addEventListener('click',function(){var url=URL.createObjectURL(_ff);window.open(url,'_blank');setTimeout(function(){URL.revokeObjectURL(url);},30000);});
      el.querySelector('#st-view').addEventListener('click',function(){showOverlay(_ft);});
    }
  }

  function showOverlay(text){
    var ov=document.createElement('div');ov.className='guts-text-overlay';
    ov.innerHTML='<div class="guts-text-overlay__inner"><div class="guts-text-overlay__bar"><span class="mono" style="font-size:9px;color:var(--muted)">FULL TEXT - '+wcnt(text).toLocaleString()+' WORDS</span><button class="btn btn-primary btn-icon" id="ov-copy">Copy all</button><button class="btn btn-ghost btn-icon" id="ov-close">Close</button></div><pre class="guts-text-overlay__content">'+esc(text)+'</pre></div>';
    document.body.appendChild(ov);
    ov.querySelector('#ov-copy').addEventListener('click',function(){navigator.clipboard.writeText(text).then(function(){toast('Copied to clipboard');}).catch(function(){toast('Copy failed');});});
    ov.querySelector('#ov-close').addEventListener('click',function(){document.body.removeChild(ov);});
  }

  function setMsg(on,msg){var el=elC.querySelector('#g-proc-status'),tx=elC.querySelector('#g-proc-msg');if(el)el.classList.toggle('hide',!on);if(tx&&msg)tx.textContent=msg;}
  var tick=function(){return new Promise(function(r){setTimeout(r,20);});};
  async function runProc(text,title){
    try{
      if(autoMode&&AI.hasAnyRoute()){setMsg(true,'AI writing your Deep English story...');await tick();text=await aiStory(text);}
      setMsg(true,'Analysing text...');await tick();
      var les=procText(text,title);
      setMsg(true,'Enriching vocabulary...');await autoHindi(les);
      setMsg(true,'Generating questions...');les.questions=await aiQuiz(les.chunks.map(function(c){return c.text;}).join(' '));
      updateKnow(les.allVocab,les.id);sL(les);
      toast('Saved - '+les.chunks.length+' chunks | '+les.allVocab.length+' vocab'+(autoMode?' | AI story':''));
      lessonId=les.id;route('lesson');
    }catch(e){toast('Failed: '+e.message);}
    finally{setMsg(false);}
  }

  /* ── LIBRARY ─────────────────────────────────────────────── */
  function renderLibrary(){
    var ls=gL();var html='<div class="guts-section">'+ls.length+' LESSON'+(ls.length!==1?'S':'')+'</div>';
    if(!ls.length)html+='<div class="guts-empty"><div class="guts-empty__icon">📚</div>No lessons yet</div>';
    else ls.forEach(function(l){html+='<div class="guts-lesson-card" data-id="'+esc(l.id)+'"><div class="guts-lesson-card__status '+sCls(l.status)+'">'+sLbl(l.status)+'</div><div class="guts-lesson-card__title">'+esc(l.title)+'</div><div class="guts-lesson-card__meta">'+l.chunks.length+' chunks | '+l.allVocab.length+' vocab | '+gFmt(l.createdAt)+'</div><div class="guts-lesson-card__arrow">-&gt;</div></div>';});
    elC.innerHTML=html;
    elC.querySelectorAll('.guts-lesson-card').forEach(function(c){c.addEventListener('click',function(){lessonId=c.dataset.id;route('lesson');});});
  }

  /* ── LESSON READER ───────────────────────────────────────── */
  function findEx(lesson,word){var re=new RegExp('\\b'+word+'\\b','i');for(var i=0;i<(lesson&&lesson.chunks||[]).length;i++){var c=lesson.chunks[i];var m=c.sentences&&c.sentences.find(function(s){return re.test(s);});if(m)return m.slice(0,100)+(m.length>100?'...':'');}return '';}
  function showPopup(word,lesson,wb){
    if(!popup)return;
    var hi=hindi(word),know=gK(),kn=know[word],saved=wb.has(word);
    popup.querySelector('#gwp-word').textContent=word;popup.querySelector('#gwp-word').dataset.word=word;
    popup.querySelector('#gwp-hindi').textContent=hi||'-- enriching...';popup.querySelector('#gwp-hindi').style.color=hi?'var(--lime)':'var(--dim)';
    popup.querySelector('#gwp-freq').textContent=kn?'Seen '+kn.count+' times':'First time';
    var ex=findEx(lesson,word);popup.querySelector('#gwp-ex').textContent=ex?'"'+ex+'"':'';
    popup.querySelector('#gwp-save').textContent=saved?'Saved':'+ Words';popup.querySelector('#gwp-save').disabled=saved;
    popup.querySelector('#gwp-synonyms').textContent='--';popup.querySelector('#gwp-deva').textContent='--';
    popup.querySelector('#gwp-enrich-btn').textContent='Enrich';popup.querySelector('#gwp-enrich-btn').disabled=false;
    popup.classList.remove('hide');
    if(!hi&&AI.hasAnyRoute()){enrichWord(word).then(function(d){if(d&&d.devanagari&&d.devanagari[0])popup.querySelector('#gwp-hindi').textContent=d.devanagari[0];});}
  }

  function renderLesson(){
    var les=gL().find(function(l){return l.id===lessonId;});if(!les){route('library');return;}
    var wb=new Set(gW().map(function(w){return w.word;})),know=gK();
    var html='<div style="background:var(--surface);border:0.5px solid var(--border);padding:12px 14px;margin-bottom:10px">';
    html+='<div class="guts-lesson-card__status '+sCls(les.status)+'">'+sLbl(les.status)+'</div>';
    html+='<div style="font-family:var(--serif);font-size:20px;margin-bottom:4px">'+esc(les.title)+'</div>';
    html+='<div style="font-size:9px;color:var(--muted);margin-bottom:10px">'+les.chunks.length+' chunks | '+les.allVocab.length+' vocab | '+gFmt(les.createdAt)+'</div>';
    html+='<div class="guts-row"><button class="btn'+(les.status==='done'?' btn-primary':'')+'" id="l-mark">'+(les.status==='done'?'Done':'Mark done')+'</button><button class="btn btn-rust" id="l-del">Delete</button><button class="btn btn-ghost" id="l-back">Library</button></div></div>';
    html+='<div id="ra-les-cont"></div>'; /* RA injected here */
    html+='<div class="guts-section">Story</div><div id="l-chunks">';
    les.chunks.forEach(function(c,i){var t=typeof c==='string'?c:(c&&c.text?c.text:'');html+='<div class="guts-chunk" id="chunk-'+i+'"><div class="guts-chunk__num">S'+(i+1)+'</div><div class="guts-chunk__text">'+renderWords(t,wb,know)+'</div>';if(c&&c.phrases&&c.phrases.length){html+='<div class="guts-chunk__phrases">';c.phrases.forEach(function(p){html+='<span class="guts-badge">'+esc(p)+'</span>';});html+='</div>';}html+='</div>';});
    html+='</div>';
    if(les.allVocab.length){html+='<div class="guts-section">Key vocabulary</div><div class="guts-vocab-grid">';les.allVocab.forEach(function(w){var hi=hindi(w),kn=know[w],sv=wb.has(w);html+='<button class="guts-vocab-chip'+(sv?' saved':'')+'" data-word="'+esc(w)+'">'+esc(w);if(hi)html+='<span class="guts-vocab-chip__hi">'+esc(hi.split('(')[0].trim())+'</span>';if(kn&&kn.count>1)html+='<span class="guts-vocab-chip__freq">'+kn.count+'x</span>';html+='</button>';});html+='</div>';}
    if(les.allPatterns.length){html+='<div class="guts-section">Long patterns <button class="guts-mini-btn" id="l-drill">Drill</button></div><div id="l-patterns">';les.allPatterns.forEach(function(p,i){html+='<div class="guts-pattern" id="pat-'+i+'"><span style="color:var(--lime-dim)">+</span><span class="guts-pattern__text">'+esc(p)+'</span><button class="guts-pattern__listen" data-text="'+esc(p)+'">Play</button></div>';});html+='</div>';}
    if(les.allPhrases.length){html+='<div class="guts-section">Key phrases</div><div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px">';les.allPhrases.forEach(function(p){html+='<span class="guts-badge">'+esc(p)+'</span>';});html+='</div>';}
    if(les.questions&&les.questions.length)html+='<div class="guts-section">Comprehension check</div><div id="l-quiz"></div>';
    elC.innerHTML=html;

    /* Build RA bar */
    var raLes=elC.querySelector('#ra-les-cont');
    if(raLes){
      var leSents=les.chunks.flatMap(function(c){var t=typeof c==='string'?c:(c&&c.text?c.text:'');return tokSents(t);});
      createRA(raLes,'les','rec.les.'+les.id,
        function(){return leSents;},
        function(idx){elC.querySelectorAll('.guts-chunk').forEach(function(c){c.classList.remove('speaking');});if(idx>=0){var c=elC.querySelector('#chunk-'+Math.floor(idx/3));if(c)c.classList.add('speaking');}}
      );
    }

    elC.querySelector('#l-back').addEventListener('click',function(){route('library');});
    elC.querySelector('#l-del').addEventListener('click',function(){if(!confirm('Delete "'+les.title+'"?'))return;dL(les.id);toast('Deleted');route('library');});
    elC.querySelector('#l-mark').addEventListener('click',function(){les.status=les.status==='done'?'reading':'done';sL(les);renderLesson();});
    elC.querySelector('#l-chunks').addEventListener('click',function(e){var w=e.target.closest('.gw');if(w)showPopup(w.dataset.word,les,wb);else popup&&popup.classList.add('hide');});
    elC.querySelectorAll('.guts-vocab-chip').forEach(function(c){c.addEventListener('click',function(){showPopup(c.dataset.word,les,wb);});});
    elC.querySelectorAll('.guts-pattern__listen').forEach(function(b){b.addEventListener('click',function(e){e.stopPropagation();speak(b.dataset.text,_rate);});});
    var db=elC.querySelector('#l-drill');if(db)db.addEventListener('click',function(){toggleDrill(db);});
    if(les.questions&&les.questions.length){var qz=elC.querySelector('#l-quiz');if(qz)renderQuiz(les.questions,qz);}
  }

  function toggleDrill(btn){drillMode=!drillMode;elC.querySelectorAll('#l-patterns .guts-pattern').forEach(function(p){var span=p.querySelector('.guts-pattern__text');if(drillMode){span.dataset.orig=span.textContent;span.innerHTML='<span class="guts-drill-hidden">Tap to reveal</span>';span.addEventListener('click',function f(){span.textContent=span.dataset.orig;span.removeEventListener('click',f);},{once:true});}else{if(span.dataset.orig)span.textContent=span.dataset.orig;}});if(btn)btn.textContent=drillMode?'Exit drill':'Drill';}

  function renderQuiz(questions,el){
    var html='';
    questions.forEach(function(q,i){html+='<div class="guts-quiz-q"><div class="guts-quiz-sent">'+esc(q.q||q.sentence||'')+'</div><div class="guts-quiz-opts">';(q.options||[]).forEach(function(o){html+='<button class="guts-quiz-opt" data-q="'+i+'" data-opt="'+esc(o)+'" data-ans="'+esc(q.answer)+'">'+esc(o)+'</button>';});html+='</div><div class="guts-quiz-result" id="qr-'+i+'"></div></div>';});
    el.innerHTML=html;
    el.querySelectorAll('.guts-quiz-opt').forEach(function(btn){btn.addEventListener('click',function(){var qi=btn.dataset.q,correct=btn.dataset.opt===btn.dataset.ans;elC.querySelectorAll('.guts-quiz-opt[data-q="'+qi+'"]').forEach(function(b){b.disabled=true;if(b.dataset.opt===btn.dataset.ans)b.classList.add('correct');else if(b===btn)b.classList.add('wrong');});var res=elC.querySelector('#qr-'+qi);if(res){res.textContent=correct?'Correct!':'Answer: '+btn.dataset.ans;res.style.color=correct?'var(--lime)':'var(--rust)';}});});
  }

  /* ── WORD BANK ───────────────────────────────────────────── */
  function renderWordBank(){
    var wb=gW().sort(function(a,b){return b.savedAt-a.savedAt;});
    var sevenD=7*24*60*60*1000;
    var html='<div class="guts-section">'+wb.length+' SAVED WORD'+(wb.length!==1?'S':'')+'</div>';
    if(!wb.length)html+='<div class="guts-empty"><div class="guts-empty__icon">💡</div>No words saved yet<br><span style="font-size:10px">Tap any word while reading a lesson</span></div>';
    else wb.forEach(function(w){
      var review=(Date.now()-(w.lastReviewed||w.savedAt))>sevenD;
      var cached=SCOPE.get('wc.'+w.word,null);var autoHi=hindi(w.word);
      var recKey='rec.word.'+w.word;var rec=hasRec(recKey);
      html+='<div class="guts-wb-card'+(review?' review':'')+'">';
      html+='<div class="guts-wb-section-a"><div style="flex:1">';
      if(review)html+='<div class="guts-wb-review-badge">Repeat Review</div>';
      html+='<div class="guts-wb-word">'+esc(w.word)+'</div>';
      if(autoHi)html+='<div class="guts-wb-hindi">'+esc(autoHi)+'</div>';
      if(w.example)html+='<div style="font-size:10px;color:var(--muted);font-style:italic;margin-top:3px">"'+esc(w.example)+'"</div>';
      html+='<div style="font-size:8px;color:var(--dim);margin-top:4px">'+gFmt(w.savedAt)+'</div></div>';
      html+='<div class="guts-wb-actions"><button class="guts-wb-btn wb-sys-play" data-word="'+esc(w.word)+'">System</button><button class="guts-wb-btn del wb-del" data-id="'+esc(w.id)+'">X</button></div></div>';
      html+='<div class="guts-wb-section-b"><div class="guts-wb-section-label">EN SIMILAR</div>';
      if(cached)html+='<div class="guts-wb-synonyms">'+esc(cached.synonyms.join(' | '))+'</div>'+cached.sentences.map(function(s){return '<div class="guts-wb-example">'+esc(s)+'</div>';}).join('');
      else html+='<button class="guts-enrich-trigger wb-enrich" data-word="'+esc(w.word)+'">Enrich via AI</button>';
      html+='</div><div class="guts-wb-section-c"><div class="guts-wb-section-label" style="font-family:var(--mono)">HI DEVANAGARI</div>';
      if(cached&&cached.devanagari)html+='<span style="font-family:\'Noto Sans Devanagari\',sans-serif">'+cached.devanagari.join(' | ')+'</span>';
      else if(autoHi)html+='<span style="font-family:\'Noto Sans Devanagari\',sans-serif;color:var(--muted)">'+esc(autoHi)+'</span>';
      else html+='<span style="color:var(--dim);font-size:10px">-- enrich to see</span>';
      html+='</div>';
      /* My Voice section per word */
      html+='<div class="guts-wb-rec" id="wb-rec-'+esc(w.word)+'"><span class="guts-wb-rec-label">MY VOICE</span>';
      if(rec)html+='<button class="guts-ra-btn" data-word="'+esc(w.word)+'" data-action="play">Play</button><button class="guts-rec-btn" data-word="'+esc(w.word)+'" data-action="rerec">Re-rec</button><button class="guts-ra-btn" style="color:var(--rust)" data-word="'+esc(w.word)+'" data-action="delrec">Del</button>';
      else html+='<button class="guts-rec-btn" data-word="'+esc(w.word)+'" data-action="rec">Record</button>';
      html+='</div></div>';
    });
    elC.innerHTML=html;

    elC.querySelectorAll('.wb-del').forEach(function(btn){btn.addEventListener('click',function(e){e.stopPropagation();dW(btn.dataset.id);toast('Word removed');renderWordBank();});});
    elC.querySelectorAll('.wb-sys-play').forEach(function(btn){btn.addEventListener('click',function(e){e.stopPropagation();var w=gW().find(function(x){return x.word===btn.dataset.word;});speak(btn.dataset.word+(w&&w.hindi?' '+w.hindi:''),_rate);if(w){w.lastReviewed=Date.now();sW(w);}});});
    elC.querySelectorAll('.wb-enrich').forEach(function(btn){btn.addEventListener('click',async function(e){e.stopPropagation();btn.textContent='...';btn.disabled=true;var data=await enrichWord(btn.dataset.word);if(data){toast('Enriched');renderWordBank();}else{btn.textContent='No AI route';btn.disabled=false;toast('Set an API key in Settings');}});});

    /* Word recording controls */
    elC.querySelectorAll('[data-action]').forEach(function(btn){
      btn.addEventListener('click',async function(e){
        e.stopPropagation();
        var word=btn.dataset.word,action=btn.dataset.action;
        var recKey='rec.word.'+word;
        if(action==='play'){stopSpeak();playRec(recKey,function(){toast('Done');});}
        else if(action==='delrec'){if(!confirm('Delete recording for "'+word+'"?'))return;delRec(recKey);renderWordBank();}
        else if(action==='rec'||action==='rerec'){
          btn.textContent='...';btn.disabled=true;
          var ok=await startRec(recKey,function(){renderWordBank();toast('Saved: '+word);});
          if(!ok){btn.textContent=action==='rec'?'Record':'Re-rec';btn.disabled=false;return;}
          btn.textContent='Stop';btn.disabled=false;
          btn.addEventListener('click',function stop(){stopRec();btn.removeEventListener('click',stop);},{once:true});
        }
      });
    });
  }

  /* ── NOTES ───────────────────────────────────────────────── */
  function renderNotes(){
    var notes=gN(),active=noteId?notes.find(function(n){return n.id===noteId;}):notes[0];
    var html='<div class="guts-pages-nav">';
    notes.forEach(function(n,i){html+='<button class="guts-page-btn'+(active&&n.id===active.id?' active':'')+'" data-nid="'+esc(n.id)+'">Page '+(i+1)+'</button>';});
    html+='<button class="guts-page-btn add" id="n-add">+</button></div>';
    if(active){
      html+='<input type="text" class="guts-note-title" id="n-title" value="'+esc(active.title)+'" placeholder="Page title..." maxlength="60">';
      html+='<div class="guts-rte-toolbar">';
      html+='<button class="guts-rte-btn" data-cmd="bold"><strong>B</strong></button>';
      html+='<button class="guts-rte-btn" data-cmd="heading">H</button>';
      html+='<button class="guts-rte-btn" data-cmd="highlight">Hi</button>';
      html+='<button class="guts-rte-btn" data-cmd="preview" id="rte-prev">View</button>';
      html+='<button class="guts-rte-btn" data-cmd="fontsize">aA</button>';
      html+='<label class="guts-rte-btn" style="cursor:pointer" title="Attach image">Img<input type="file" id="n-attach" accept="image/*" hidden></label>';
      html+='<div style="flex:1"></div>';
      html+='<button class="guts-rte-btn del" id="n-del">Del</button></div>';
      html+='<div id="ra-note-cont"></div>'; /* RA + recording injected here */
      html+='<div class="guts-rte" id="n-rte" contenteditable="true" data-placeholder="Start writing your story or notes here...">'+(active.content||'')+'</div>';
      html+='<div class="guts-note-footer"><span id="n-status" style="font-size:9px;color:var(--dim)">Auto-saved</span><span style="font-size:9px;color:var(--dim)">Updated '+gFmt(active.updatedAt||active.createdAt)+'</span></div>';
    }else{
      html+='<div class="guts-empty"><div class="guts-empty__icon">📝</div>No pages yet - tap + to create one</div>';
    }
    elC.innerHTML=html;
    elC.querySelectorAll('.guts-page-btn[data-nid]').forEach(function(b){b.addEventListener('click',function(){noteId=b.dataset.nid;renderNotes();});});
    elC.querySelector('#n-add').addEventListener('click',function(){var n={id:'note_'+gId(),pageNum:notes.length+1,title:'Page '+(notes.length+1),content:'',createdAt:Date.now(),updatedAt:Date.now()};sN(n);noteId=n.id;renderNotes();});
    if(!active)return;

    var rte=elC.querySelector('#n-rte'),titleEl=elC.querySelector('#n-title'),status=elC.querySelector('#n-status');

    function autoSave(){
      if(_imgCleanup){/* deselect images before saving so no wrapper divs saved */
        rte.querySelectorAll('.guts-img-wrapper').forEach(function(w){var img=w.querySelector('img');if(img)w.parentNode.insertBefore(img,w);w.remove();});}
      active.content=rte.innerHTML;active.title=titleEl.value||'Page '+(notes.indexOf(active)+1);active.updatedAt=Date.now();sN(active);
      if(status)status.textContent='Saved';setTimeout(function(){if(status)status.textContent='Auto-saved';},1500);
      var words=[...new Set((rte.innerText.match(/\b[a-zA-Z]{7,}\b/g)||[]).filter(function(w){return !CW.has(w.toLowerCase());}).map(function(w){return w.toLowerCase();}))];
      if(words.length)updateKnow(words,active.id);
    }

    rte.addEventListener('input',function(){if(status)status.textContent='Unsaved...';clearTimeout(saveTimer);saveTimer=setTimeout(autoSave,1500);});
    titleEl.addEventListener('blur',autoSave);

    /* Image controls */
    if(_imgCleanup){_imgCleanup();}
    _imgCleanup=attachImgControls(rte,autoSave);

    /* Note RA bar with own voice */
    var raNoteEl=elC.querySelector('#ra-note-cont');
    if(raNoteEl){
      createRA(raNoteEl,'note','rec.note.'+active.id,
        function(){return tokSents(rte.innerText||'');},
        null /* no chunk highlighting in notes */
      );
    }

    var prevMode=false;var fsSizes=['12px','14px','18px'];
    elC.querySelectorAll('.guts-rte-btn[data-cmd]').forEach(function(btn){btn.addEventListener('click',function(){rte.focus();var cmd=btn.dataset.cmd;if(cmd==='bold')document.execCommand('bold',false,null);else if(cmd==='heading')document.execCommand('formatBlock',false,'h3');else if(cmd==='highlight')document.execCommand('hiliteColor',false,'rgba(212,255,58,0.22)');else if(cmd==='preview'){prevMode=!prevMode;rte.contentEditable=prevMode?'false':'true';rte.style.background=prevMode?'var(--surface)':'';btn.classList.toggle('active',prevMode);}else if(cmd==='fontsize'){fontIdx=(fontIdx+1)%3;rte.style.fontSize=fsSizes[fontIdx];}});});
    elC.querySelector('#n-attach').addEventListener('change',function(e){var file=e.target.files[0];if(!file)return;var r=new FileReader();r.onload=function(){rte.focus();document.execCommand('insertHTML',false,'<img src="'+r.result+'" style="max-width:100%;margin:4px 0">');autoSave();};r.readAsDataURL(file);e.target.value='';});
    elC.querySelector('#n-del').addEventListener('click',function(){if(!confirm('Delete "'+active.title+'"?'))return;if(_imgCleanup){_imgCleanup();_imgCleanup=null;}dN(active.id);noteId=null;toast('Page deleted');renderNotes();});
  }

  /* ── TRANSFER ────────────────────────────────────────────── */
  function renderTransfer(){
    var ls=gL(),wb=gW(),notes=gN(),know=gK();
    var aiOn=AI.hasAnyRoute();var providers=AI.getProviders()||{},order=AI.getFallbackOrder()||[];
    var html='<div class="guts-section">Version</div><div class="frame subtle" style="padding:10px 14px;margin-bottom:12px"><span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>';
    html+='<div class="guts-info-row"><span class="guts-info-row__k">MODULE</span><span class="guts-info-row__v">Get Up To Speed</span></div>';
    html+='<div class="guts-info-row"><span class="guts-info-row__k">VERSION</span><span class="guts-info-row__v">v'+V+'</span></div>';
    html+='<div class="guts-info-row"><span class="guts-info-row__k">MOD NO.</span><span class="guts-info-row__v">09</span></div></div>';

    /* Voice settings */
    html+='<div class="guts-section">Voice Settings</div><div class="frame subtle" style="padding:10px 14px;margin-bottom:12px"><span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>';
    html+='<div class="guts-label">Reading voice (used for System Read Aloud)</div>';
    html+='<select id="voice-sel" class="guts-input" style="margin-bottom:8px"><option value="">Loading voices...</option></select>';
    html+='<div style="font-size:9px;color:var(--dim)">If no voice is set, device default is used. Hindi voices (hi-IN) will read Hindi text naturally.</div></div>';

    html+='<div class="guts-section">AI Status</div><div class="frame subtle" style="padding:10px 14px;margin-bottom:12px"><span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>';
    html+='<div class="guts-info-row"><span class="guts-info-row__k">STATUS</span><span class="'+(aiOn?'guts-ai-on':'guts-ai-off')+'" style="font-size:12px">'+(aiOn?'READY':'NO KEY')+'</span></div>';
    order.forEach(function(id){var p=providers[id]||{},hasKey=!!AI.getKey(id);html+='<div class="guts-info-row"><span class="guts-info-row__k">'+(p.icon||'')+' '+(p.label||id)+'</span><span style="font-size:11px;color:'+(hasKey?'var(--lime)':'var(--dim)')+';">'+(hasKey?'Key set':'no key')+'</span></div>';});
    html+='<div style="margin-top:6px;font-size:9px;color:var(--dim)">Configure in Settings - API Keys</div></div>';

    html+='<div class="guts-section">Data</div><div class="frame subtle" style="padding:10px 14px;margin-bottom:12px"><span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>';
    html+='<div class="guts-info-row"><span class="guts-info-row__k">LESSONS</span><span class="guts-info-row__v">'+ls.length+'</span></div>';
    html+='<div class="guts-info-row"><span class="guts-info-row__k">WORD BANK</span><span class="guts-info-row__v">'+wb.length+'</span></div>';
    html+='<div class="guts-info-row"><span class="guts-info-row__k">NOTES</span><span class="guts-info-row__v">'+notes.length+' pages</span></div>';
    html+='<div class="guts-info-row"><span class="guts-info-row__k">KNOWLEDGE</span><span class="guts-info-row__v">'+Object.keys(know).length+' words</span></div></div>';
    html+='<div class="guts-row" style="margin-bottom:8px"><button class="btn btn-primary" id="g-export">Export</button><button class="btn" id="g-import">Import</button></div>';
    html+='<div class="guts-section" style="margin-top:16px">Security</div><div class="frame subtle" style="padding:10px 14px"><span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>';
    html+='<div class="guts-info-row"><span class="guts-info-row__k">LOCK</span><span class="guts-info-row__v">6-digit PIN</span></div>';
    html+='<div style="margin-top:8px;display:flex;gap:6px"><button class="btn btn-ghost btn-icon" id="t-chpin" style="font-size:10px">Change PIN</button><button class="btn btn-rust btn-icon" id="t-lock" style="font-size:10px">Lock now</button></div></div>';
    elC.innerHTML=html;

    /* Populate voice dropdown async */
    loadVoices(function(voices){
      var sel=elC.querySelector('#voice-sel');if(!sel)return;
      var saved=SCOPE.get('voice.uri','');
      var opts='<option value="">-- Device default --</option>';
      voices.forEach(function(v){opts+='<option value="'+esc(v.voiceURI)+'"'+(v.voiceURI===saved?' selected':'')+'>'+esc(v.name)+' ('+esc(v.lang)+')</option>';});
      sel.innerHTML=opts;
      sel.addEventListener('change',function(){SCOPE.set('voice.uri',sel.value);toast('Voice saved');});
    });

    elC.querySelector('#g-export').addEventListener('click',doExport);
    elC.querySelector('#g-import').addEventListener('click',doImport);
    elC.querySelector('#t-lock').addEventListener('click',lock);
    elC.querySelector('#t-chpin').addEventListener('click',function(){if(!confirm('Change PIN?'))return;SCOPE.remove('pinHash');lock();toast('PIN cleared - set a new one');});
  }

  function doExport(){if(!gL().length&&!gW().length&&!gN().length){toast('Nothing to export yet');return;}var data={_meta:{module:'Get Up To Speed',version:V,exportedAt:new Date().toISOString()},lessons:gL(),wordbank:gW(),notes:gN(),knowledge:gK()};downloadFile('guts-backup-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(data,null,2),'application/json');toast('Export downloaded');}
  async function doImport(){var file=await pickFile('.json,application/json');if(!file)return;try{var data=JSON.parse(await file.text());if(!data.lessons)throw new Error('Invalid backup');(data.lessons||[]).forEach(function(l){sL(l);});(data.wordbank||[]).forEach(function(w){sW(w);});(data.notes||[]).forEach(function(n){sN(n);});if(data.knowledge)SCOPE.set('knowledge',data.knowledge);toast('Imported '+data.lessons.length+' lessons');renderTransfer();}catch(e){toast('Import failed: '+e.message);}}

  return{
    onShow:function(){setAI();},
    cleanup:function(){stopSpeak();stopPlayback();if(_imgCleanup){_imgCleanup();_imgCleanup=null;}lock();clearTimeout(saveTimer);}
  };
}
