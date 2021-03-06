﻿jQuery.fn.just_text = function() {
    return $(this).children()
        .end()
        .text();
}

function filter_nodes(nodes, regexp) {
    return $(nodes).find('[contenteditable!="true"][contenteditable!="plaintext-only"]').addBack().filter(
        function(index) {
			var result = false;
			var text = $(this).just_text();
            var found = (text.search(regexp) != -1)
			if(found) {
				var html = $(this).html();
				if(html) {
					var index = html.indexOf("document.write");
					result = (index == -1);
				} else {
					result = true;
				}
			}
            return result;
		}
    );
}

function on_mutation(mutations) {
    for(var i = 0; i < mutations.length; i++) {
        var mutation = mutations[i];
        var added = mutation.addedNodes;
        var target = mutation.target;
        
        if(added.length > 0) {
            var nodes = filter_nodes(added, regexp);
            run(nodes);
        }
    }
}

function get_replacement(matched, code) {
	var image = matched.image;
	var name = "";
	var id = matched.id;
	if(id != "") {
		name = chrome.i18n.getMessage(id);
	}
	if(name == "") {
		name = matched.name;
	}
	var relative = "images/" + image;
	var absolute = chrome.extension.getURL(relative);
	var element = "<img src='" + absolute + "' class='emoji'";
	if(name != "") {
		element += " title='" + name + "' alt='" + code + "' ";
	}
	element += "style='height:" + scale + "em !important; ";
	element += "width:" + scale + "em !important; ";
	element += "float:none !important' ";
	element += ">";
	return element;
}

function run(nodes) {
    $.each(nodes,
        function() {
        	var node = $(this);
        	
        	if(!$(node).html()) {
        		node = $(node).parent();
        	}
        	
        	if($(node).html()) {
        		var html = $(node).html();
				var replace = html.replace(regexp,
					function(c) {
						if(usefont) {
							return "<span class='emojifont' style='font-size:" + scale + "em !important' >" + c + "</span>";
						} else {
							// emoji variation sequences
							var vs = '';
							if (c.length >= 2) {
								if (c[c.length - 1] === '\uFE0E') {
									// U+FE0E VARIATION SELECTOR-15 (for non-emoji)
									return c.substr(0, c.length - 1);
								} else if (c[c.length - 1] === '\uFE0F') {
									// U+FE0F VARIATION SELECTOR-16 (for emoji)
									c = c.substr(0, c.length - 1);
									vs = '\uFE0F';
								}
							}
							var matched = valid.filter(
								function(element, index, array) {
									if(element.chars.indexOf(c) != -1) {
										return element.image;
									}
								}
							);
					
							if(matched.length > 0) {
								return get_replacement(matched[0], c + vs);
							}
						}
					
						return c;
					}
				);
				$(node).html(replace);
            }
        }
    );
}

function start_observer() {
    var target = document.body;
    var config = { childList: true, characterData: true, subtree: true };
    var observer = new WebKitMutationObserver(on_mutation);
    observer.observe(target, config);
}

function create_pattern(items) {
    pattern = "";
    items.forEach(
        function (element, index, array) {
            var chars = element.chars;
            chars.forEach(
                function (element, index, array) {
                    if(hidden.indexOf(element) == -1) {
                        pattern += (element + "[\uFE0F\uFE0E]?|");
                    }
                }
            );
        }
    );

    if (pattern != "") {
        pattern = pattern.substr(0, pattern.length - 1);
    }
}

function init() {
	chrome.extension.sendMessage({setting: "scale"},
        function (response) {
        	scale = response.result;
			chrome.extension.sendMessage({setting: "ioscompat"},
				function (response) {
					ioscompat = (response.result == "true");
					chrome.extension.sendMessage({setting: "usefont"},
						function(response) {
							usefont = (response.result == "true");
							readCharDictionary(
								function (chars) {
									charDictionary = chars
									items = chars.items;
									if(ioscompat) {
										hidden = chars.ioshidden;
									} else {
										hidden = [];
									}

									// Don't render OS X font chars on OS X
									if(window.navigator.appVersion.indexOf("Mac") != -1) {
										hidden = hidden.concat(chars.machidden);
									}

									valid = items.filter(
										function (element, index, array) {
											return (element.image != "");
										}
									);

									create_pattern(valid);
									regexp = new RegExp(pattern, 'g');
									var nodes = filter_nodes($('body'), regexp);
									run(nodes);
									start_observer();
								}
							);
						}
					);
				}
			);
		}
	);
}

var charDictionary;
var items;
var valid;
var pattern;
var regexp;
var ioscompat;
var hidden;
var blacklist;
var usefont;
var scale;

$(document).ready(
    function () {
        chrome.extension.sendMessage({setting: "blacklist"},
            function (response) {
                if(response.result) {
                    blacklist = response.result.split(',');
                } else {
                    blacklist = [];
                }

                var blacklisted = false;
                $.each(blacklist,
                    function(key, value) {
                    	var pos = document.domain.indexOf(value);
                        if(pos >= 0 && pos == document.domain.length - value.length) {
                            blacklisted = true;
                        }
                    }
                );

                if(!blacklisted) {                    
                    init();
                }
            }
        );
    }
);
