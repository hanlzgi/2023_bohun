/**-------------------------------------------------------------------------------------------------
*										컴포넌트 모달팝업 스크립트
*																					Date	: 2019.12.30
*																					Author	:  jr
**/
eBookCore.components.popModal = function(container, data){ // container : DIV
	
	var addEl = $("<div/>")
		.attr({
            'class'			    : 'ebookpagecomp',
			'name'			    : data.name,
			'id'				: data.id,
		})
		.css({
			'position'	: 'absolute',
			'visibility'	: 'hidden',
		});
	
	container.append(addEl); // 
}
