/**-------------------------------------------------------------------------------------------------
*											eBook Core
*																					
*																					Author		: jr
*																					Nexbook air core : 1.24
*																					latest date : 2023-10-30
**/
var eBookCore = {};

/** 맴버 변수 정의&초기화 */
eBookCore.currentPageNum		= null;	// 현재 페이지 번호
eBookCore.pageOrigWidth		= 0;		// 페이지 원본 이미지 너비
eBookCore.pageOrigHeight		= 0;		// 페이지 원본 이미지 높이
eBookCore.thumbRatio				= 1;		// 섬네일 가로세로비
eBookCore.path						= {};		// 파일경로
eBookCore.eventType				= {};		// 키,마우스,터치 이벤트 속성
eBookCore.searchCountMax		= 10;		// 검색기능 사용시 한 번에 추가할 항목 제한 개수( ★페이지 단위로 체크하므로 초과될 수 있음 )
eBookCore.keyDownState			= [];		// 키입력 상태 체크

/** 서브 객체 정의 */
eBookCore.func			= {};	// 기능 함수 객체( functions.js )
var eFnc = eBookCore.func;	// 단축명 정의( skin.js 에서 활용 )

/**-------------------------------------------------------------------------------------------------
*		페이지 넘김 객체 사전 정의
*/
eBookCore.pageTurn	= {
	init									: function()								{ croTools.log("not defined : eBookCore.pageTurn.init");	 },
	update								: function(pageNum)				{ croTools.log("not defined : eBookCore.pageTurn.update"); },
	getVisiblePageNumbers		: function()								{ croTools.log("not defined : eBookCore.pageTurn.getVisiblePageNumbers"); return null;	},
	addBookmarkToPage			: function(pageNum, addObj)	{ croTools.log("not defined : eBookCore.pageTurn.addBookmarkToPage"); },
	getZoomRatio						: function()								{ croTools.log("not defined : eBookCore.pageTurn.getZoomRatio");					return 1; 		}
};

/**-------------------------------------------------------------------------------------------------
*		플러그인
*/
eBookCore.plugins			= {};

/**-------------------------------------------------------------------------------------------------
*		컴포넌트
*/
eBookCore.components	= {
	data		: [],
	
	// 외부에서 정의될 항목들
	action		: function()	{ croTools.log("not defined : eBookCore.components.action");},
	video		: function()	{ croTools.log("not defined : eBookCore.components.video"	);},
	youtube		: function()	{ croTools.log("not defined : eBookCore.components.youtube"	);} /** youtube */,	
	audio		: function()	{ croTools.log("not defined : eBookCore.components.audio"	);},
	image		: function()	{ croTools.log("not defined : eBookCore.components.image"	);},
	imageSlider	: function()	{ croTools.log("not defined : eBookCore.components.imageSlider"	);},  /** 슬라이드 이미지 */
	text		: function()	{ croTools.log("not defined : eBookCore.components.text"	);},
	link		: function()	{ croTools.log("not defined : eBookCore.components.link"	);},
	popmodal	: function()	{ croTools.log("not defined : eBookCore.components.popmodal"	);},	/** 모달 팝업 */

	
	// 페이지 비율에 맞춰 사이즈 재조정
	resizing : function(e)	{
		e = $(e);
		var _data = eBookCore.components.data[e.attr("id")];
		//var _ratio = eBookCore.pageTurn.getZoomRatio();
		var _ratioW = eBookCore.pageTurn.getZoomRatio('w');
		var _ratioH = eBookCore.pageTurn.getZoomRatio('h');
		
		if("false" === _data.visible){
			if(!$(".videoAir").hasClass("on") && !$(".embed_youtube").hasClass("on")){
				e.css("visibility", "hidden");
				e.parent(".videoAir").css("visibility", "hidden");
			}
		}

		if(0<e.closest(".videoAir").length){ // e : video,audio
			
			e.css({
				'width'		: (_ratioW * parseInt(_data.width))	+ 'px',
				'height'	: (_ratioH * parseInt(_data.height))	+ 'px'
			});
			
			e = e.closest(".videoAir");
			e.css({
				'left'		: (_ratioW * parseInt(_data.x))			+ 'px',
				'top'			: (_ratioH * parseInt(_data.y))			+ 'px',
				'width'		: (_ratioW * parseInt(_data.width))	+ 'px',
				'height'	: (_ratioH * parseInt(_data.height))	+ 'px'
			});
			return;
		}
		
		e.css({
			'left'		: (_ratioW * parseInt(_data.x))			+ 'px',
			'top'			: (_ratioH * parseInt(_data.y))			+ 'px',
			'width'		: (_ratioW * parseInt(_data.width))	+ 'px',
			'height'	: (_ratioH * parseInt(_data.height))	+ 'px'
		});
		
		if(!isNaN(_data.textHeight)){ // text component
			e.css( 'font-size', (_ratioH * parseInt(_data.textHeight))	+ 'px' );
		}
	},

	// 모달팝업 이벤트 설정   jr 
	setPopModalEvent : function(popmodalEl) {
	
		// 데이터형식 :	 { type:"popModal", id:"popModal123", name:"모달1", event:"onRelease",dispatcher:"Link21576817996413",  target:"Image11576544358449", action:"toggleVisible", },
		var _data = eBookCore.components.data[$(popmodalEl).attr("id")];		
		var btn_closemodal = $('.btn_closemodal');   // 닫기 버튼 

		var getElById = function(_id){ // ID에 해당하는 객체 반환 ( 미디어 예외 적용 )
			var targetEl = $("#"+_id);
			if(1>targetEl.length){ return; }
			type_play = targetEl[0].tagName;

			return targetEl;
		};
		
		var dispatchEl = getElById(_data.dispatcher);
		dispatchEl.css("cursor", "pointer"); // 마우스 커서 버튼형으로 설정

		if(!dispatchEl){ return croTools.log("popmodal dispatcher not found : " + _data.dispatcher) }
		
		
		if(_data.action=="toggleVisible") {		// 클릭해서 팝업 보이기일때 

			var targetEl = (_data.target);
				targetEl = $("#"+ targetEl)   // 이미지 el
			var modalpop = $("#modal_wrap");
			var targetId = getElById(_data.target);

			dispatchEl.on("click", function(e){

				targetsrc =  targetEl[0];     // 이미지 태그
				//modalpop.children('img').css('visibility','hidden');
				targetId.clone().appendTo(modalpop);  // 타겟 아이디를 modal_wrap 으로 클론시킴
				modalpop.addClass('on');
				
				
				modalpop.children(targetEl.selector).css('visibility','visible').css('top','').css('left','');
				modalpop.css('visibility','visible');

				modalpop.on('scroll touchmove mousewheel', function(event) {   //모달 사용시 스크롤 막기 
				  event.preventDefault();
				  event.stopPropagation();
				  return false;
				});
			
			});

			$(".bg_modal,.btn_closemodal").on("click", function(e){  //모달 팝업 닫았을 때 해당 이미지,동영상 삭제
				targetsrc =  targetEl[0];     // 이미지 태그
				modalpop.css('visibility','hidden');
				modalpop.removeClass('on');
				modalpop.children(targetEl.selector).detach(); 
				modalpop.off('scroll touchmove mousewheel');
			});
		}

		
	},
		
	// 액션 이벤트 설정
	setActionEvent : function(actionEl) {

		// 데이터형식 : { type:"action", id:"Interaction11435134959473", name:"액션1", height:"16", width:"17", y:"574", x:"900", dispatcher:"Link11435050004029", event:"onRelease", target:"Mp3Player11435050111825", action:"toggleVisible",  },
		var _data = eBookCore.components.data[$(actionEl).attr("id")];

		if(_data.type == "action") {   // 일반 액션일때 jr 20201126
		
				if(_data.action!=="toggleVisible")	{ return croTools.log("unexpected action type : "+_data.action); }	// 모르는 액션 속성이면 로그기록 후 중단
				if(_data.event!=="onRelease")	{ return croTools.log("unexpected event type : "+_data.event); }	// 모르는 이벤트 속성이면 로그기록 후 중단
				
				var type_play ;   // 비디오 오디오 타입 
					
				var getElById = function(_id){ // ID에 해당하는 객체 반환 ( 미디어 예외 적용 )
					var targetEl = $("#"+_id);
					if(1>targetEl.length){ return; }
					type_play = targetEl[0].tagName;
					
					if("VIDEO"===targetEl[0].tagName
					|| "AUDIO"===targetEl[0].tagName){
						return targetEl.closest(".videoAir");
					}
					return targetEl;
				};
				
				var dispatchEl = getElById(_data.dispatcher);
				if(!dispatchEl){ return croTools.log("action dispatcher not found : " + _data.dispatcher) }
				
				dispatchEl.on("click", function(e){
					croTools.log("action toggle");

					
					var targetEl = getElById(_data.target);
					if(!targetEl){ return croTools.log("action target not found : " + _data.target) }

					if(type_play == 'AUDIO') {																				
						audioFactory.getById(_data.target).togglePlay();
					}
					if (targetEl.hasClass("embed_youtube")) {
						targetEl.toggleClass("on");
					};					
					if(type_play == 'VIDEO') {		
						if(targetEl.css('visibility') == 'hidden'){
							targetEl.css('visibility','visible');
							targetEl.children('video').css('visibility', 'visible' );
							targetEl.addClass('on'); 
						}
						else{
							targetEl.css('visibility','hidden');
							targetEl.children('video').css('visibility', 'hidden' );
							targetEl.removeClass('on'); 
						}

					}			
					else {
						
						targetEl.css('visibility', targetEl.css('visibility') == 'hidden' ? 'visible' : 'hidden' );//targetEl.toggle(); 2018-12-19 오디오 수정 
					}
				});
			}

				
	},
	
	// 링크 롤오버, 클릭 이벤트 설정
	setLinkEvent : function(linkEl) {
		
		$(linkEl).hover(function(e){
			//croTools.log("link hover in");
			var _data = eBookCore.components.data[$(e.target).attr("id")];
			$(e.target).css('background-color', croTools.hexToRGBA( _data.rolloverColor.substr(0,8).replace("0x","#")		, _data.rolloverColor.substr(9)	));
		},function(e){
			//croTools.log("link hover out");
			var _data = eBookCore.components.data[$(e.target).attr("id")];
			$(e.target).css('background-color', croTools.hexToRGBA( _data.backgroundColor.substr(0,8).replace("0x","#")	, _data.backgroundColor.substr(9)	));
		});
		
		$(linkEl).off("click"); // 이전 등록이벤트 제거 후 새로 등록
		$(linkEl).on("click", eBookCore.components.openLinkByData);
	},
	
	// 링크 데이터 처리
	openLinkByData : function(e){
		var _link;
		if( $(e.target).attr("id") === undefined || $(e.target).attr("id").length == 0 ) _link = $(e.target).attr("data-link").split("|");	//	슬라이드 이미지 
		else _link = eBookCore.components.data[$(e.target).attr("id")].link.split("|");	//	이미지
		
		switch(_link[0]){
			case "address"	: // 새창
				if (/^\.{0,2}\//.test(_link[2])) {	// [261113] ./ ../ / 로 시작하는 상대경로는 그대로 열기
					window.open( _link[2], _link[1] );
					break;
				}
				if (!_link[2].startsWith("http")) {
					_link[2] = "https://" + _link[2];
				};
				7<_link[2].length && window.open( /*url*/_link[2], _link[1]);
				break;
				
			case "popup"		: // 팝업
				{
					var _url = _link[6].split("(_-__-_)")[0];
					if (!_url.startsWith("http")) {
						_url = "https://" + _url;
					};
					7<_url.length && window.open( _url, _link[0], "left=" + _link[1] + ", top="+_link[2] + ", width="+_link[3] + ", height="+_link[4] );
				}
				break;
				
			case "page"		: // 페이지 이동
				eBookCore.func.gotoPage( parseInt( _link[1] ) );
				break;

			case "etclink"	: // 전화, 메일 링크
				7<_link[1].length && window.open( /*url*/_link[1], '_blank');
				break;

			case "filelink"	: // 첨부 파일 링크 
				let linkurl = './assets/contents/' + _link[1];
				4<_link[1].length && window.open( linkurl , '_blank');
				break;
				
			default:
				croTools.log("unknown link type : "+_link[0]);
		}
	},
	
	// 텍스트박스 클릭 이벤트 설정
	setTextEvent : function(textEl) {
		$(textEl).off("click"); // 이전 등록이벤트 제거 후 새로 등록
	},
	
	// 이미지 클릭 이벤트 설정
	setImageEvent : function(imgEl) {
		$(imgEl).off("click"); // 이전 등록이벤트 제거 후 새로 등록
		$(imgEl).on("click", eBookCore.components.openLinkByData);
	},



	// 비디오 재생 컴포넌트 생성 : 넥스북에어 jr 20191217
	createMediaPlayerAir : function(e){
		e=$(e);
		
		if (e.closest(".videoAir").length) { 
		}
		else{
			e.wrap("<div class='videoAir '></div>");  // 상위 노드로 감싸기 
			var videoAir = e.closest(".videoAir");
				
			videoAir.attr("style", e.attr("style"))
			videoAir.css("position","absolute");
			videoAir.css("background-color","#000000");
			videoAir.css("display","block");

			// video,audio에서 불필요한 속성 제거
			e.attr({'width':'','height':''}).css({ left:'', top:'', visibility:'' });

			// 버튼이미지가 있으면 추가
			var _data = eBookCore.components.data[e.attr("id")];
			if(_data.normalImage && 0<_data.normalImage.length){
				var _url = eBookCore.path.contents+_data.normalImage;
				videoAir.append("<img src='"+_url+"' title='play button image' style='width:100%;height:100%;position:absolute;left:0;top:0;'/>");
			}
			
			videoAir.children('img').click(function(){
				$(this).hide();
				$(this).prev('video').get(0).play();
			});

		}

 

		var mediaContainer = e.closest(".videoAir");
		if(1>mediaContainer.length){ // 아이폰계열에서 객체를 얻지 못하는 문제 보완
			e = $("#"+e.attr("id"));
			mediaContainer = e.closest(".videoAir");
			
			if(1>mediaContainer.length){
				return croTools.log("createMediaPlayer : media container not found.");
			}
		}
		
	
		
		// 자동실행 컴포넌트 처리( 모바일환경에선 자동실행 사용 안함, VIDEO 자동실행 안함, AUDIO는 autoplay 속성 체크 )
		if(!croTools.isMobile() && "VIDEO"!==e[0].tagName && "true"===eBookCore.getDataById(e[0].id).autoplay){
			var _pageNum	= eBookCore.getPageNumById(e.attr("id"));
			var _pageNums	= eBookCore.pageTurn.getVisiblePageNumbers();
			if(!_pageNums){ return croTools.log("failed : getVisiblePageNumbers"); }
			for(var i=0; i<_pageNums.length; ++i){
				//croTools.log("autoplay page nums : "+ _pageNums[i] + " / " + _pageNum);
				if(_pageNums[i]===_pageNum){
					croTools.log("autoplay : "+_pageNum + " / " + e.get(0));
					e.get(0).play();
				}
			}
		}


	},

   //   슬라이드 이미지 2018-12-20
   calcDimensions : function(e) {
      e = $(e);
      var _data = eBookCore.components.data[e.attr("id")];
      if( $('#' + _data.id +'_').attr("data-status") === "run" ) return;         //   ------------------> 추가
      $('#' + _data.id).css( { "max-width": $('#' + _data.id).css("width") } );   //   ul Wrapper
      $('#' + _data.id +'_').children("li").children("img").css({"width": $('#' + _data.id).css("width") , "height": $('#' + _data.id).css("height")});   //   ul > li > img
   },   
	/** -------------------------- 20181228 -------------------------- */
    loadSlider : function(e) {   
      e = $(e);
      var _data = eBookCore.components.data[e.attr("id")];

		if( $('#' + _data.id +'_').attr("data-status") === "run" ) { 
			if( eBookCore.components.isThisCurrentPage($('#' + _data.id +'_').attr("data-page" )) ){ 
				try{
					var _now_ = eBookCore.components.nowTime();
					var elapsed = eBookCore.components.elapsedTime( $('#' + _data.id +'_').attr("data-refresh") ,_now_ );
					if( parseInt(elapsed) > 500 ) eBookCore.components.forceRefresh(); //	0.5s == 500ms
					$('#' + _data.id +'_').attr({ 'data-refresh'  : _now_ });
				}catch(error){
					console.log(error.message);
				}finally{
				}
			} 
			return; 
		}   
		var slider = $('#' + _data.id +'_').lightSlider({   //   ul
         gallery:false,
         item:1,
         slideMargin: 0,
         speed:1000,
		 pause:4000,
         auto: "false"===_data.visible ? false : true /** ul Wrapper */ ,			// jr 슬라이드 터치 수정 2019-12-18
         loop:true,
         pauseOnHover: true,
	     enableDrag:true,
		 enableTouch:true,
		 controls:false,
         pager:true,
         onSliderLoad: function(el) {
            $('#' + _data.id +'_').removeClass('cS-hidden');
            $('#' + _data.id +'_').addClass('lsGrab');
            $('#' + _data.id +'_').attr({ 'data-status'  : 'run' });
			if( eBookCore.components.isThisCurrentPage($('#' + _data.id +'_').attr("data-page" )) ){ 
				eBookCore.components.forceRefresh(); 
			}
         }
      });
   },

	unloadSlider : function( e1 ) {
		console.log('do something');
	} , 
	isThisCurrentPage : function(page){
		var _pageNums	= eBookCore.pageTurn.getVisiblePageNumbers();
		for(var i=0; i<_pageNums.length; ++i){
			if( parseInt(_pageNums[i]) === parseInt(page)){
				return true;
			}
		}
		return false;
	},
	forceRefresh : function(){
		if ( eBookCore.components.isIe() ) {
			var evt = document.createEvent('HTMLEvents'); 
			evt.initEvent('resize', true, true); 
			window.dispatchEvent(evt);
			if( eBookCore.pageTurn.getVisiblePageNumbers() % 2 != 0 ) {
				window.dispatchEvent(evt);
			}
	}else{
			 window.dispatchEvent(new Event('resize'));
			 if( eBookCore.pageTurn.getVisiblePageNumbers() % 2 != 0 ) {
				window.dispatchEvent(new Event('resize'));
			}
		}
	},
	nowTime : function() { return ( new Date() ).getTime(); } , 
	elapsedTime : function(start , end){ return end - start; },
	isIe : function(){
		var ua = window.navigator.userAgent;
		var msie = ua.indexOf('MSIE ');
		var trident = ua.indexOf('Trident/');
		return (msie > 0 || trident > 0);
	}	
	/** --------------------------  end -------------------------- */
};



/**-------------------------------------------------------------------------------------------------
*		언어팩 ( 사용 예 : eBookCore.getString("result") )  - 
		다국어 설정시 메뉴 텍스트 추가 jr 
		fr : 프랑스, es : 스페인어,  vi : 베트남어 
*/
eBookCore.string = {
	search				: { en:"Search"	,				ko:"검색"					,	ja:"檢索"					,	zh:"檢索"			, fr : "Recherche" , es : "indagación", vi : "sự tìm kiếm" },
	input_here			: { en:"Input here"		,	ko:"여기에 입력"		,		ja:"ここに入力"		,	zh:"在这里输入"	, fr : "Entrée ici" , es : "Introducción a esto.", vi : "Nhập vào đây" },
	result					: { en:"Result"				,	ko:"결과"					,	ja:"結果"					,	zh:"結果"			, fr : "Résultat" , es : "consecuencia", vi : "kết quả" },
	search_more		: { en:"▼more▼"		,		ko:"▼더 보기▼"			,	ja:"次へ"					,	zh:"下一次"			, fr : "plus" , es : "más", vi : "nhiều hơn" },
	contents				: { en:"Contents"			,	ko:"목차"					,	ja:"目次"					,	zh:"目次"			, fr : "Contenu" , es : "tabla de materias", vi : "mục lục" },
	bookmark			: { en:"Bookmark"		,		ko:"북마크"					,	ja:"ブックマーク"	,		zh:"书签"			, fr : "Marque-pages" , es : "marcadores del tambor", vi : "dấu sách" },
	unusable			: { en:"Unusable"		,		ko:"사용 불가"			,		ja:"使用不可"			,	zh:"不可用"			, fr : "Inutilisable" , es : "inutilidad", vi : "không thể sử dụng được" },
	first_page			: { en:"First page"		,		ko:"첫 페이지"			,		ja:"最初のページ"	,		zh:"第一页"			, fr : "Première page" , es : "primera página", vi : "trang đầu tiên" },
	last_page			: { en:"Last page"		,		ko:"끝 페이지"			,		ja:"最後のページ"	,		zh:"最后一页"		, fr : "dernière page" , es : "página", vi : "trang cuối cùng" },
	memo				: { en:"Memo"		,			ko:"메모"					,	ja:"メモ"					,	zh:"记录"			, fr : "Mémo" , es : "memorándum", vi : "ghi chép" },
	writehere			: { en:"Write here"	,		ko:"여기에 작성"		,		ja:"ここに作成"		,	zh:"写在这里"		, fr : "Écrivez ici" , es : "Está escrito aquí.", vi : "Tạo ở đây" },
	save					: { en:"Save"				,	ko:"저장"					,	ja:"保存"					,	zh:"保存"			, fr : "Enregistrer" , es : "almacenamiento", vi : "sự lưu trữ" },
	cancel				: { en:"Cancel"				,	ko:"취소"					,	ja:"キャンセル"		,	zh:"取消"			, fr : "Annuler" , es : "retractación", vi : "sự hủy bỏ" },
	close					: { en:"Close"				,	ko:"닫기"					,	ja:"閉じる"				,	zh:"关闭"			, fr : "Fermé" , es : "cerramiento", vi : "Đóng lại" },
	minimization		: { en:"minimization"		,	ko:"최소화"					,	ja:"最小化"				,	zh:"最小化"			, fr : "Minimisation" , es : "minimización", vi : "tối thiểu hóa" },
	memoexpansion	: { en:"expansion"		,		ko:"최대화"					,	ja:"最大化"				,	zh:"最大化"			, fr : "extension" , es : "maximización", vi : "tối đa hóa" },
	print					: { en:"Print"				,	ko:"인쇄"					,	ja:"プリント"			,	zh:"印刷"			, fr : "Imprimer" , es : "tirado", vi : "sự in ấn" },
	printPreview		: { en:"Print preview",		ko:"인쇄 미리보기"	,		ja:"プレビュー"		,	zh:"预览"			, fr : "Prévisualisation" , es : "preimpresión", vi : "Bản in thử" },
	printRange			: { en:"Print range"	,		ko:"인쇄 범위"			,		ja:"範囲"					,	zh:"範圍"			, fr : "Range d'impression" , es : "imprenta esfera de", vi : "phạm vi in ấn" },
	currentPage		: { en:"Current page"	,	ko:"현재 페이지"		,		ja:"現在ページ"		,	zh:"当前页"			, fr : "Page courante" , es : "página actual", vi : "trang hiện tại" },
	selectRange		: { en:"Select range"	,		ko:"범위 지정"			,		ja:"範囲指定"			,	zh:"指定范围"		, fr : "Sélectionner le champ" , es : "localización", vi : "chỉ định phạm vi" },
	allPages				: { en:"All pages"		,		ko:"전체 페이지"		,		ja:"全体ページ"		,	zh:"整个页面"		, fr : "Toutes les pages" , es : "página entera", vi : "toàn bộ trang" },
	printPageJpg		: { en:"Normal"		,		ko:"일반화질"		,			ja:"一般画質"		,		zh:"正常"			, fr : "Normalement" , es : "calidad de baja definición", vi : "chất lượng bình thường" },
	printPageSvg		: { en:"High"		,			ko:"고화질"		,				ja:"高画質"		,			zh:"高清"			, fr : "Haute" , es : "calidad de alta definición", vi : "chất lượng cao" },
	printPageAlert		: { en:"High quality printing may not print entire pages, depending on computer specifications.\n(PC memory 16GB or higher recommended / 1page printable)"		,
		ko:"고화질 인쇄시, 컴퓨터 사양에 따라 전체 페이지가 인쇄 되지 않을 수 있습니다.\n(PC 메모리 16GB 이상 권장/ 이하의 경우 1page씩 인쇄 가능)"	,
		ja:"高画質 印刷時に、コンピュータの仕様に応じてページ全体が印刷されないことがあります.\n(PCメモリ16GB以上を推奨/以下の場合1pageずつ印刷可能)"		,
		zh:"当高品质的打印，根据您的计算机的规格，则无法打印整个页面。（如果电脑内存16GB或1/1比较推荐/打印更少）"		, 
		fr : "Lors de l'impression en haute résolution, la page entière peut ne pas être imprimée selon les spécifications de l'ordinateur.\n(Primez 1 page pour 16GB ou plus de mémoire de votre PC)" , 
		es : "Para la impresión de alta definición, es posible que toda la página no sea impresa según las especificaciones de la computadora.\n(Si se recomienda o no 16GB de memoria PC o más, se puede imprimir en 1 página).", 
		vi : "Khi in chất lượng cao, có thể không thể in toàn bộ trang tùy thuộc vào thông số kỹ thuật của máy tính\n(Giới thiệu trên 16GB bộ nhớ PC và dưới 1 trang có thể in)" },
	zoomIn				: { en:"Zoom in"			,	ko:"확대"					,	ja:"拡大"					,	zh:"扩大"			, fr : "Zoom" , es : "ampliación", vi : "sự phóng đại" },
	zoomOut			: { en:"Zoom out"			,	ko:"축소"					,	ja:"縮小"					,	zh:"缩小"			, fr : "Réduction" , es : "disminución", vi : "sự thu nhỏ lại" },
	undo					: { en:"Undo"				,	ko:"실행취소"			,		ja:"アンドゥ"			,	zh:"撤消"			, fr : "Annulation" , es : "retractación", vi : "sự hủy bỏ" },
	redo					: { en:"Redo"				,	ko:"실행복구"			,		ja:"リドゥ"				,	zh:"重做"			, fr : "Récupération de l'exécution" , es : "restauración", vi : "sự phục hồi" },
	clear					: { en:"Clear"				,	ko:"초기화"					,	ja:"初期化"				,	zh:"初始化"			, fr : "Initialisation" , es : "inicialización", vi : "sự khởi tạo" },
	download			: { en:"Download"		,	ko:"내려받기"				,	ja:"ダウンロード"	,		zh:"下载"			, fr : "Télécharger le fichier" , es : "Descarga.", vi : "Tải xuống" },
	opacity				: { en:"Opacity"		,		ko:"투명도"					,	ja:"透明度"				,	zh:"透明度"			, fr : "Opacité" , es : "La opacidad", vi : "Tính không rõ ràng" },
	pen					: { en:"Pen"				,		ko:"펜"						,	ja:"ペン"					,	zh:"笔"				, fr : "Penne" , es : "Pena", vi : "Bút" },
	marker				: { en:"Marker"				,	ko:"마커"					,	ja:"マーカー"			,	zh:"记号笔"			, fr : "Marqueur" , es : "Marker", vi : "Điểm đánh dấu" },
	submit				: { en:"Submit"				,	ko:"확인"					,	ja:"確認"					,	zh:"确认"			, fr : "Soumettre" , es : "Envíen", vi : "Trình" },

	menu					: { en : "Menu" ,				ko:"메뉴",						ja:"メニュー"	,			zh:"栏目"			, fr : "Menu" , es : "Menu", vi : "Thực đơn" },			/* 메뉴 */
	fullscreen			: { en : "Full Screen" ,		ko:"전체화면",					ja:"全画面"	,				zh:"全屏"			, fr : "Écran plein" , es : "pantalla completa", vi : "toàn bộ màn hình" },			/* 전체화면 */
	lastebook			: { en : "View past Book" ,	ko:"지난호보기",				ja:"過去の本を読む"	,	zh:"看上一本书"	, fr : "Voir le livre précédent" , es : "Vean el libro pasado", vi : "Xem lại quá khứ" },			/* 지난호보기 */
	prev_page			: { en : "Prev page"		,	ko:"이전페이지",				ja:"前のページ"	,		zh:"上一页"			, fr : "Page précédente" , es : "página anterior", vi : "Trang trước khi phát hành" },			/* 이전 페이지 */
	next_page			: { en : "Next page"		,	ko:"다음페이지",				ja:"次のページ"	,		zh:"下一页"			, fr : "Page suivante" , es : "La siguiente página", vi : "Trang tiếp theo" },			/*	다음 페이지	*/
	home					: { en : "Home" ,				ko:"홈",							ja:"最初のページ"	,		zh:"首页"			, fr : "page d'accueil" , es : "a la primera página", vi : "ở trang đầu tiên" },			/*	홈	*/
	twitter				: { en : "Twitter" ,				ko:"트위터",					ja:"ツイッター"	,		zh:"Twitter"			, fr : "Twitter" , es : "Twitter", vi : "Twitter" },			/*	트위터	*/
	facebook			: { en : "Facebook" ,			ko:"페이스북",					ja:"フェイスブック"	,	zh:"Facebook"		, fr : "Facebook" , es : "Facebook", vi : "Facebook" },			/*	페이스북	*/
	kakao				: { en : "Kakao" ,				ko:"카카오톡",					ja:"カカオトーク"	,		zh:"Kakao Talk"	, fr : "Kakao" , es : "Kakao", vi : "Kakao" },			/* 카카오톡		*/
    autoslide			: { en : "Auto slide",			ko:"자동넘김",					ja:"サムネイル"		,	zh:"缩略图"			, fr : "Diaporama automatique" , es : "Auto-slide", vi : "Trượt tự động" },			/* 자동넘김		*/

    thumnail			: { en : "Thumnail Image", ko:"썸네일",						ja:"サムネイル"		,	zh:"缩略图"			, fr : "Image de la page d'accueil" , es : "El Tumnaile", vi : "Thumnail" },			/* 썸네일		*/
    pdf_down			: { en : "Pdf file Download",ko:"PDF 다운로드",			ja:"PDFダウンロード",	zh:"PDF下载"		, fr : "Télécharger PDF" , es : "Dele el archivo al Pdf", vi : "Download tập tin Pdf" },			/*	PDF 다운로드	*/
    drawing				: { en : "Drawing"	,			ko:"판서",						ja:"板書"		,				zh:"判书"			, fr : "Dessins" , es : "Dibujo", vi : "Vẽ" },			/*	판서	*/
    sns					: { en : "Share ebook"	,		ko:"공유하기",			ja:"共有"		,			zh:"电子书分享"		, fr : "Partage d'ebook" , es : "comunicación", vi : "chia sẻ ebook" },			/*	sns 공유	*/	
    qrcode				: { en : "QR code"	,		ko:"QR 코드",			ja:"QRコード"		,			zh:"二维码"		, fr : "QR code" , es : "Código QR", vi : "Mã QR" },			/*	qr code	*/	
    copyLink				: { en : "COPY"	,		ko:"COPY",			ja:"COPY"		,			zh:"COPY"		, fr : "COPY" , es : "COPY enlace", vi : "COPY" },			/*	이북 링크 복사	*/	

		

	enter_pwd			: { en : "Please enter your password.",
								ko : "암호를 입력해 주세요.",
								ja : "暗号を入力してください。",
								zh : "请输入您的密码",
								fr : "Entrez votre mot de passe." , 
								es : "Introduzca la contraseña.", 
								vi : "Vui lòng nhập mật khẩu" 
								},
	incorrect_pwd		: { en : "You entered an incorrect password.",
								ko : "틀린 암호를 입력하셨습니다.",
								ja : "間違ったパスワードを入力しました。",
								zh : "您输入的密码不正确",
								fr : "Vous avez entré un mauvais mot de passe." , 
								es : "Usted ha escrito la contraseña equivocada.", 
								vi : "Bạn đã nhập mật khẩu sai" 
								},
	sns_msg				: { en : "I introduce my NexBook.",
								ko : "저의 NexBook을 소개합니다.",
								ja : "私のNexBookを紹介します。",
								zh : "我介绍一下我的NexBook.",
								fr : "Je vous présente mon NexBook." , 
								es : "Permítame presentarle a mi NexBook.", 
								vi : "Mình sẽ giới thiệu NexBook cho các bạn" 
								},
	linkCopy			: { en : "The link has been copied.",
								ko : "링크가 복사되었습니다.",
								ja : "リンクがコピーされました。",
								zh : "链接已复制",
								fr : "Le lien a été copié" , 
								es : "El enlace ha sido copiado.", 
								vi : "Liên kết đã được sao chép." 
								}
};

/**-------------------------------------------------------------------------------------------------
*		페이지 언어에 맞는 문자열 반환
*/
eBookCore.getString = function(text){
	try{
		return 	eBookCore.string[ text ][ croTools.getLang() ]
				||	eBookCore.string[ text ][ "en" ] /* default language */ ;
	}catch(err){
		croTools.log("getString( " + text + " ) error : " + err.message);
		return ("unexpected string : " + text);
	}
};




/**-------------------------------------------------------------------------------------------------
*		컨텐츠 ID값으로 컨텐츠가 들어있는 페이지 번호 반환
*/
eBookCore.getPageNumById = function(id){
	var _cont = eBookData.pageContents;
	for(var i=0; i<_cont.length; ++i){
		for(var k=1; k<_cont[i].length; ++k){
			var _data = _cont[i][k];
			
			if(_cont[i][k].id===id){
				return _cont[i][0]; // pageNum
			}
		}
	}
	return croTools.log("not found page number : unknown id="+id);
};

/**-------------------------------------------------------------------------------------------------
*		컨텐츠 ID값으로 컨텐츠정보 반환
*/
eBookCore.getDataById = function(id){
	var _cont = eBookData.pageContents;
	for(var i=0; i<_cont.length; ++i){
		for(var k=1; k<_cont[i].length; ++k){
			var _data = _cont[i][k];
			
			if(_cont[i][k].id===id){
				return _cont[i][k];
			}
		}
	}
	return croTools.log("not found data : unknown id="+id);
};
