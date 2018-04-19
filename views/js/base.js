$(document).ready(function () {
    $('a').each(function() {
        var anchor = this;
        var anchorHtml = $(anchor).html();
        var anchorText = $(anchor).text();
        
        if (anchorHtml == anchorText) {
            // text only, do nothing
        }
        else if (anchorHtml.length > anchorText.length) {
            // text is shorter than HTML
            if (anchorText.length == 0) {
                // HTML only
                $(anchor).has('i').addClass('anchor-i');
                $(anchor).has('img').addClass('anchor-img');
            }
            else {
                // code snippets
                $(anchor).has('code').addClass('anchor-code');
                // text and icon, check for external icon
                if ($(anchor).find('i').hasClass('icons8-open-in-window')) {
                    // external link, show icon on hover
                    $(anchor).has('i').addClass('anchor-external');
                } else {
                    // do nothing, show icon all the time
                }
            }
        }
    });
});