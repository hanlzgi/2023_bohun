/**-------------------------------------------------------------------------------------------------
*										컴포넌트 텍스트 스크립트
*																					Date	: 2015.07.03
*																					Author	: 박정민
**/
eBookCore.components.text = function(container, data){ // container : DIV
	
	// 헥스 컬러값을 RGBA형태로 변환
	var rgbaTextColor		= croTools.hexToRGBA( data.textColor.substr(0,8).replace("0x","#")				, data.textColor.substr(9)				);
	var rgbaBgColor			= croTools.hexToRGBA( data.backgroundColor.substr(0,8).replace("0x","#")	, data.backgroundColor.substr(9)	);
//	var rgbaBorderColor	= croTools.hexToRGBA( data.borderColor.substr(0,8).replace("0x","#")			, data.borderColor.substr(9)			);

	var result = replaceAll(data.text,"||","\n");

	function replaceAll(str, searchStr, replaceStr) {   //줄바꿈 교체
	  return str.split(searchStr).join(replaceStr);
	};



	var addEl = $("<textarea>"+result+"</textarea>")
		.attr({
			'class'			: 'ebookpagecomp',
			'readonly'		: 'readonly',
			'id'				: data.id,
		})
		.css({
			'position'					: 'absolute',
			'overflow'					: 'auto',
			'font-family'				: data.font,
			'letter-spacing'			: data.letterSpacing,
			'text-align'				: data.align,
			'font-style'				: (data.italic==='true' ? 'italic' : 'normal'),
			'font-weight'			: (data.bold==='true' ? 'bold' : 'normal'),
			'text-decoration'		: (data.underline==='true' ? 'underline' : 'none'),
			'color'						: rgbaTextColor,
			'background-color'	: rgbaBgColor,
//			'border-color'			: rgbaBorderColor,
			'border-width'			: '0px',
		});
	
	container.append(addEl); // ※ flip 효과 발생시 IE에서 다른 컴포넌트가 사라지는 현상이 있음. textarea만 예외적으로 맨 아래에 삽입하면 어느정도 해결됨.
}
