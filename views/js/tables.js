$(document).ready(function () {
    
    // Alternating row color with logic for detail rows
    $('tr:not(.details)').filter(':even').css('background-color','rgba(0,0,0,.05)');
    $('tr:not(.details)').filter(':odd').css('background-color','rgba(0,0,0,0)');
    $('tr.details').each(function(i,e){
        $(this).css('background-color',$(this).prev().css('background-color'));
    });
    
    // Sortable headers and up/down icons
    $('th.sort a').click(function () {
        var table = $(this).closest('table');
        if ($(this).parent('th').hasClass('active')) {
            // active sort header
            if ($(this).hasClass('toggle')) {
                $(this).siblings('a').each(function(){
                    $(this).toggleClass('active');
                });
            } else if ($(this).hasClass('down') && !$(this).hasClass('active')) {
                $(this).toggleClass('active');
                $(this).siblings('a.up').toggleClass('active');
            } else if ($(this).hasClass('up') && !$(this).hasClass('active')) {
                $(this).toggleClass('active');
                $(this).siblings('a.down').toggleClass('active');
            }
        } else {
            // inactive sort header
            $(table).find('th.sort, th.sort a').removeClass('active');
            $(this).parent('th').addClass('active');
            if ($(this).hasClass('toggle')) {
                $(this).next('a.down').addClass('active');
                $(this).next('a.up').removeClass('active');
            } else if ($(this).hasClass('down')) {
                $(this).addClass('active');
            } else if ($(this).hasClass('up')) {
                $(this).addClass('active');
            }
        }
        return false;
    });
    
    // Show scroll shadows when table can scroll horizontally
    $('table').each(function() {
        var table = this;
        var tableWrap = $(this).parent('.table-wrap');
        var wrapWidth = $(tableWrap).width();
        var tableWidth = $(table).outerWidth();
        
        if (tableWidth > wrapWidth) {
            // Show right shadow when table can only scroll right
            $(tableWrap).addClass('shadow-r');
        }
        else {
            $(tableWrap).removeClass('shadow-r');
        }
        $(tableWrap).scroll(function(){
            var tableScroll = $(this).scrollLeft();
            if (tableScroll == (tableWidth - wrapWidth)) {
                // Show left shadow when table can only scroll left
                $(this).removeClass('shadow-rl shadow-r').addClass('shadow-l');
            } else if (tableScroll > 0) {
                // Show left and right shadows when table can scroll both ways
                $(this).removeClass('shadow-l shadow-r').addClass('shadow-rl');
            } else {
                // Show right shadow when table can only scroll right
                $(this).removeClass('shadow-l shadow-rl').addClass('shadow-r');
            }
        });
        $(window).resize(function() {
            var tableScroll = $(tableWrap).scrollLeft();
            wrapWidth = $(tableWrap).width();
            tableWidth = $(table).outerWidth();
            
            if (tableWidth > wrapWidth) {
                if (tableScroll == (tableWidth - wrapWidth)) {
                    // Show left shadow when table can only scroll left
                    $(tableWrap).removeClass('shadow-rl shadow-r').addClass('shadow-l');
                } else if (tableScroll > 0) {
                    // Show left and right shadows when table can scroll both ways
                    $(tableWrap).removeClass('shadow-l shadow-r').addClass('shadow-rl');
                } else {
                    // Show right shadow when table can only scroll right
                    $(tableWrap).removeClass('shadow-l shadow-rl').addClass('shadow-r');
                }
            }
            else {
                $(tableWrap).removeClass('shadow-l shadow-rl shadow-r');
            }
        });
    });
    
    // Show/hide detail rows
    $('a.details').click(function () {
        //$(this).closest('tr').next('tr.details').toggle();
        $(this).closest('tr').next('tr.details').find('.slide').slideToggle(200);
        $(this).closest('tr').next('tr.details').children('td').toggleClass('open');
        $(this).html(($(this).html() == 'Show details') ? 'Hide details' : 'Show details');
        return false;
    });
    
});