
var async = require('async'), lastOnTop, castManager, Lang = {}, clipboard = nw.Clipboard.get()

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const miniPlayerRightMargin = 18;

function mkdirr(folder){
    return fs.mkdirSync(folder, {
        recursive: true
    })
}

function enterMiniPlayer(){
    win.hide()
    setTimeout(() => { 
        miniPlayerActive = true;  
        doAction('miniplayer-on');
        var ratio = Playback.getRatio();
        var h = screen.availHeight / 3, w = scaleModeAsInt(Playback.getRatio()) * h;
        window.resizeTo(w, h);
        window.moveTo(screen.availWidth - w - miniPlayerRightMargin, screen.availWidth - h)
    }, 100)
    setTimeout(() => { 
        win.show() 
    }, 250)
}

function leaveMiniPlayer(){
    win.hide()
    setTimeout(() => { 
        setFullScreen(false);
        win.setAlwaysOnTop(false);
        win.show();
        doAction('miniplayer-off');
        win.hide()
    }, 100)
    setTimeout(() => { 
        win.show() 
    }, 250)
}

addAction('miniplayer-on', () => {
    sound('menu', 9);
    console.log('MP-ON', traceback(), appShown, time());
    $body.add(getFrame('overlay').document.body).addClass('miniplayer');
    win.setAlwaysOnTop(true);
    win.setShowInTaskbar(false);
    // console.log('MP-ON');
    fixMaximizeButton();
    // console.log('MP-ON');
})

addAction('miniplayer-off', () => {
    sound('menu', 9);
    console.log('MP-OFF');
    $body.add(getFrame('overlay').document.body).removeClass('miniplayer');
    //console.log('MP-OFF');
    win.setAlwaysOnTop(false);
    //console.log('MP-OFF');
    win.setShowInTaskbar(true);
    //console.log('MP-OFF');
    fixMaximizeButton();
    //console.log('MP-OFF');
    setTimeout(() => {
        if(!isFullScreen() && !isMiniPlayerActive()){
            Menu.show()
        }
    }, 500)
})

function toggleMiniPlayer(){
    if(miniPlayerActive){
        leaveMiniPlayer()
    } else {
        enterMiniPlayer()
    }
}

function toggleFullScreen(){
    setFullScreen(!isFullScreen());
}

var useKioskForFullScreen = false;
function escapePressed(){
    //win.leaveKioskMode();
    //win.leaveFullscreen();
    if(autoCleanEntriesRunning()){
        autoCleanEntriesCancel()
    } else if(isFullScreen()) {
        setFullScreen(false)
    } else {
        stop()
    }
}

function backSpacePressed(){
    if(!isMiniPlayerActive()){
        console.warn(document.URL, document.body, Menu);
        if(Menu.path){
            console.warn(document.URL, document.body, Menu);
            Menu.back()
        } else {
            if(Menu.isVisible() && !isStopped()){
                Menu.hide()
            } else {
                Menu.show()
            }
        }
    }
}

function isMaximized(){
    if(win.x > 0 || win.y > 0) return false;
    var w = top || window, widthMargin = 6, heightMargin = 6;
    return (w.outerWidth >= (screen.availWidth - widthMargin) && w.outerHeight >= (screen.availHeight - heightMargin));
}

function maximizeWindow(){
    win.setMaximumSize(0, 0);
    showRestoreButton();
    win.x = win.y = leftWindowDiff;
    setTimeout(() => {
        win.width = screen.availWidth + (leftWindowDiff * -2);
        win.height = screen.availHeight + (leftWindowDiff * -2);
        win.x = win.y = leftWindowDiff;
    }, 10)
}

function minimizeWindow(){
    if(top){
        if(isMiniPlayerActive()){
            win.minimize();
        } else {
            top.enterMiniPlayer();
        }
    }
}

var allowAfterExitPage = false;
setTimeout(() => { // avoid after exit page too soon as the program open
    allowAfterExitPage = true;
}, 10000);

function afterExitURL(){
    return "http://app.megacubo.net/out.php?ver={0}&inf={1}".format(installedVersion, verinf());
}

function afterExitPage(){
    if(allowAfterExitPage && installedVersion && uptime() > 600){
        var lastTime = GStore.get('after-exit-time'), t = time();
        if(!lastTime || (t - lastTime) > (6 * 3600)){
            GStore.set('after-exit-time', t, true);
            nw.Shell.openExternal(afterExitURL())
        }
    }
}

addAction('miniplayer-on', afterExitPage);
addAction('appUnload', afterExitPage);

var appStartTime = time();

function uptime(){
    return time() - appStartTime;
}

function shutdown(){
    var cmd, secs = 7, exec = require("child_process").exec;
    if(process.platform === 'win32') {
        cmd = 'shutdown -s -f -t '+secs+' -c "Shutdown system in '+secs+'s"';
    } else {
        cmd = 'shutdown -h +'+secs+' "Shutdown system in '+secs+'s"';
    }
    return exec(cmd)
}

function fixMaximizeButton(){
    if(typeof(isMaximized)!='undefined'){
        if(isMaximized() || miniPlayerActive){
            showRestoreButton()
        } else {
            showMaximizeButton()
        }
    }
}

function setHardwareAcceleration(enable){
    var manifest = nw.App.manifest;    
    var enableFlags = [];
    var disableFlags = ['--disable-gpu', '--force-cpu-draw'];
    enableFlags.concat(disableFlags).forEach((flag) => {
        manifest['chromium-args'] = manifest['chromium-args'].replace(flag, '')
    });
    (enable?enableFlags:disableFlags).forEach((flag) => {
        manifest['chromium-args'] = manifest['chromium-args'] += ' '+flag;
    });
    manifest['main'] = basename(manifest['main']);
    fs.writeFile('package.json', JSON.stringify(manifest, null, 3), jQuery.noop)
}

function showMaximizeButton(){
    var e = document.querySelector('.nw-cf-maximize');
    if(e){ // at fullscreen out or unminimize the maximize button was disappearing
        e.style.display = 'inline-block';
        document.querySelector('.nw-cf-restore').style.display = 'none';
    }
}

function showRestoreButton(){
    var e = document.querySelector('.nw-cf-restore');
    if(e){
        e.style.display = 'inline-block';
        document.querySelector('.nw-cf-maximize').style.display = 'none';
    }
}

function patchMaximizeButton(){
    
    var old_element = document.querySelector(".nw-cf-maximize");
    if(!old_element) return setTimeout(patchMaximizeButton, 250);
    var new_element = old_element.cloneNode(true);
    old_element.parentNode.replaceChild(new_element, old_element);
    new_element.addEventListener('click', maximizeWindow);
    
    old_element = document.querySelector(".nw-cf-restore");
    old_element.addEventListener('click', function (){
        setTimeout(fixMaximizeButton, 50);
        $win.trigger('restore')
    });
    
    patchMaximizeButton = function (){}
}

function playExternal(url){
    if(!url){
        if(Menu.isVisible()){
            var entry = Menu.selectedData();
            if(entry && entry.type=='stream'){
                url = entry.url;
            }
        }
        if(!url){
            var c = currentStream();
            if(typeof(c)!='object') return;
            url = c.url;
        }
    }
    if(isLocal(url)){
        //nw.Shell.showItemInFolder(url);
        nw.Shell.openItem(url);
    } else {
        if(isRTMP(url)) {
            url = 'https://play.megacubo.tv/rtmp-player.html?url='+encodeURIComponent(url);
        } else if(isM3U8(url)) {
            url = 'https://play.megacubo.tv/index.html?url='+encodeURIComponent(url);
        }
        nw.Shell.openExternal(url)
    }
    stop();
}

function playPause(set){
    if(!Playback.active){
        return;
    }
    if(Playback.playing()){
        Playback.pause()
    } else {
        Playback.play()
    }
}

var decodeEntities = (() => {
    // regular expression matching HTML entities
    var entity = new RegExp('&(?:#x[a-f0-9]+|#[0-9]+|[a-z0-9]+);?', 'gi')
    var element = document.createElement('div')
    return str => {
        if(str.indexOf(';') != -1){
            str = (str||'').replace(entity, m => {
                element.innerHTML = m
                return element.textContent
            })
            element.textContent = ''
        }
        return str
    }
})()

function encodeEntities(str){
    return String(str||'').replace(new RegExp('[\u00A0-\u9999<>&](?!#)', 'gim'), (i) => {
      return '&#' + i.charCodeAt(0) + ';';
    })
}

function getIntentFromURL(url){
    var urls, intent = false, frameIntents = Playback.query({type: 'frame'})
    if(url){
        url = Playback.proxy.unproxify(url)
        url = url.split('#')[0]
        for(var i=0; i<frameIntents.length; i++){
            urls = getFrameURLs(frameIntents[i].frame);
            if(matchURLs(url, urls)){
                intent = frameIntents[i];
                break;
            }
        }
    }
    return intent;
}

var requestIdReferersTable = {}, requestIdReferersTableLimit = 256, requestIdMap = {}, requestCtypeMap = {}, requestIdMapLimit = 256, minVideoContentLength = (10 * 1024);
var capturingFolder = Playback.proxyLocal.folder + path.sep + 'stream' + path.sep + 'session';

fs.exists(capturingFolder, (exists) => {
    if(exists){
        removeFolder(capturingFolder, false, jQuery.noop) // just empty the folder
    } else {
        mkdirr(capturingFolder)
    }
})

function shouldCapture() {
    return hasAction('media-received')
}

function goSideload(url, referer) {
    if(getDomain(url).indexOf(Playback.proxy.addr) == -1 && url != Playback.proxy.proxify(url) && (!referer || getDomain(referer).indexOf(Playback.proxy.addr) == -1)){
        var intent = false
        if(referer){
            intent = getIntentFromURL(referer)
        }
        if(!intent){
            intent = getIntentFromURL(url)
        }
        if(intent){
            if(intent.sideload){
                console.log('SIDELOADPLAY CALLING', url)
                intent.sideload.add(url)
            }
        } else {
            console.warn('SIDELOADPLAY FAILURE, INTENT NOT FOUND', url, referer)
        }
    }
}

function applyBlockedDomains(blocked_domains){
    var debug = debugAllow(true)
    if(typeof(blocked_domains)=='object' && jQuery.isArray(blocked_domains) && blocked_domains.length){
        chrome.webRequest.onBeforeRequest.addListener(
            (details) => {
                if(debug){
                    console.log("blocking:", details)
                }
                /*
                if(typeof(details['frameId'])!='undefined' && details.frameId && details.type=='sub_frame'){
                    return {redirectUrl: top.document.URL.replace('index.', 'block.')}
                }
                */
                return {cancel: true}
            },
            {urls: blocked_domains},
            ["blocking"]
        )
    }
}

function getFrameURLs(frame){
    var urls = [];
    if(frame){
        urls.push(frame.src);
        if(frame.contentWindow){
            try {
                var url = frame.contentWindow.document.URL;
                if(url){
                    if(urls.indexOf(url) == -1){
                        urls.push(url)
                    }
                    var frames = frame.contentWindow.document.querySelectorAll('iframe, frame');
                    for(var i=0; i<frames.length; i++){
                        let nurls = getFrameURLs(frames[i]);
                        nurls.forEach((url) => {
                            if(urls.indexOf(url) == -1){
                                urls.push(url)
                            }
                        })
                    }
                }
            } catch(e) {

            }
        }
    }
    return urls;
}

function matchURLs(url, urls){
    url = removeQueryString(url);
    for(var i=0; i<urls.length; i++){
        if(urls[i].indexOf(url)!==-1){
            return true;
            break;
        }
    }
}

function matchFrameURLs(url, frame){
    var urls = getFrameURLs(frame);
    return matchURLs(url, urls)
}

function saveAs(file, callback){
    var _callback = (file) => {
        isWritable(dirname(file), (err, writable) => {
            if(writable){
                callback(file)
            } else {
                alert(Lang.FOLDER_NOT_WRITABLE);
                saveAs(file, callback)
            }
        })
    }
    if(isFullScreen() && file){
        return _callback(file)
    }
    if(!file) file = '';
    jQuery('<input id="saveas" type="file" nwsaveas />').
        prop('nwsaveas', basename(file)).
        prop('nwworkingdir', dirname(file)).
        one('change', function (){
            var chosenFile = this.value;
            if(!chosenFile){
                chosenFile = file;
            }
            _callback(chosenFile)
        }).
        trigger('click')
} 

function pickColor(callback, defaultColor){
    jQuery('#pick-color').remove();
    jQuery('<input type="color" id="pick-color" />').
        hide().
        val(defaultColor).
        appendTo('body').
        on('change', (e) => {
            var chosenColor = e.target.value;
            if(!chosenColor){
                chosenColor = '';
            }
            callback(chosenColor)
        }).trigger('click')
}

function moveFile(from, to, callback){
    if(from == to){
        callback(to)
    } else {
        copyFile(from, to, function (err){
            if (err){
                fs.unlink(to);
                if(callback){
                    callback(from)
                }
            } else {
                fs.unlink(from, function (){
                    if(callback){
                        callback(to)
                    }
                })
            }
        })
    }
}

function makeModal(content){
    jQuery(top.document).find('body').addClass('modal');
    jQuery(content).appendTo(jQuery('#modal-overlay > div > div').html(''));
    jQuery('#modal-overlay').show()
}

function modalClose(silent){
    console.warn('modalClose', traceback());
    if(silent !== true){
        doAction('modalClose')
        removeAction('modalClose')
    }

    var d = jQuery(
        (top && top != window && typeof(top.document) !== 'undefined') ? top.document : document
    )
    d.find('body').removeClass('modal')
    d.find('#modal-overlay > div > div').html('')
    d.find('#modal-overlay').hide()
}

function modalConfirm(question, answers, closeable){
    var a = [];
    answers.forEach((answer) => {
        a.push(jQuery('<button class="button">'+answer[0]+'</button>').on('click', answer[1]).label(stripHTML(answer[0]), 'up'))
    });
    var b = jQuery('<div class="prompt prompt-'+a.length+'-columns">'+
                '<span class="prompt-header">'+nl2br(question)+'</span>'+
                '<span class="prompt-footer"></span></div>');
    b.find('.prompt-footer').append(a);
    makeModal(b, closeable);
    top.focus()
}

function modalPrompt(question, answers, placeholder, value, closeable, onclose){    
    sound('warn', 16);
    var a = [], noHeader = !question, notCloseable = typeof(onclose) != 'function';
    answers.forEach((answer) => {
        a.push(jQuery('<button class="button">' + answer[0] + '</button>').on('click', answer[1]).label(stripHTML(answer[0]), 'up'))
    });
    var b = jQuery('<div class="prompt prompt-' + a.length + '-columns '+(noHeader ? ' prompt-no-header' : '')+'">'+
        (notCloseable ? '' : '<span class="prompt-close"><a href="javascript:modalClose();void(0)"><i class="fas fa-times-circle" aria-hidden="true"></i></a></span>')+
        '<span class="prompt-header">' + nl2br(question) + '</span>' +
        '<span class="prompt-input"><input type="text" /></span>' +
        '<span class="prompt-footer"></span></div>');

    b.find('.prompt-footer').append(a)
    var t = b.find('input')
    if(placeholder){
        t.prop('placeholder', placeholder)
    }
    if(value){
        t.val(value)
    }
    makeModal(b)
    b.find('.prompt-header')[noHeader?'hide':'show']()
    var pc = b.find('.prompt-close a')
    if(closeable){
        pc.label(Lang.CLOSE, 'left')
        pc.on('click', () => {
            modalClose()
        })
        if(typeof(onclose) == 'function'){
            addAction('modalClose', onclose)
        }
    } else {
        pc.hide()
    }
    if(t.length == 1){
        t.on('blur', function (){
            jQuery(this).trigger('focus')
        })
        t.keyup((event) => {
            if(!(event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)){
                if (event.keyCode === 13) {
                    if(t.val().length){
                        a.pop().click()
                    }
                } else if (event.keyCode === 27 && !notCloseable) {
                    pc.trigger('click')
                }
            }
        })
    }
    top.focus()
    setTimeout(() => {
        var n = t.get(0)
        n.focus()
        n.select()
    }, 400)
}

function modalPromptInput(){
    return jQuery('.prompt').find('input, textarea');
}

function isModal(){
    return jQuery('.prompt').length;
}

function modalPromptVal(){
    return modalPromptInput().val().trim() || '';
}

function shouldOpenSandboxURL(url, callback){
    jQuery.get(url, function (response){
        console.log(url, response.length);
        var m = response.match(new RegExp('(\.m3u8|rtmp:|jwplayer|flowplayer|Clappr|<video)', 'i'));
        if(m){
            console.log('POPUP ALLOWED', url);
            console.log(m);
            callback(url)
        }
    })
}

function testEntry(entry, success, error, returnSucceededIntent, callback){
    var resolved = false, intents = [];    
    var type = getStreamBasicType(entry);
    if(type){
        if(typeof(customMediaTypes[type]) != 'undefined'){
            if(typeof(customMediaTypes[type]['testable']) != 'undefined' && !customMediaTypes[type]['testable']){
                success();
                return intents;
            }
        }
    }
    if(isMegaURL(entry.url)){
        success();
        return intents;
    }
    var checkr = () => {
        if(resolved) return;
        var worked = false, complete = 0, succeededIntent = null;
        for(var i=0; i<intents.length; i++){
            if(!intents[i]) continue;
            if(intents[i].started || intents[i].ended || intents[i].error){
                complete++;
            }
            if(!worked && intents[i].started && !intents[i].ended && !intents[i].error){
                if(returnSucceededIntent){
                    intents[i].shadow = false;
                    intents[i].manual = true;
                    succeededIntent = intents[i];
                }
                worked = true;
            }
        }
        console.warn('CHECKR', intents, complete, worked);
        if(worked || complete == intents.length){
            resolved = true;
            for(var i=0; i<intents.length; i++){ // ready
                if(intents[i].shadow && (!succeededIntent || (intents[i].entry.url != succeededIntent.entry.url))){
                    intents[i].destroy()
                }
            }   
            (worked ? success : error)(succeededIntent)
        }
    }
    createPlayIntent(entry, {shadow: true, manual: false, start: checkr, error: checkr, ended: checkr}, (err, intent) => {
        if(intent){
            intents.push(intent)
        }
    })
}

var inFullScreen = false;

function isFullScreen(){
    return ( win && win.width >= screen.width && win.height >= screen.height) || !!(win.isKioskMode || win.isFulscreen)
}

function maxPortViewSize(width, height){
    return;
    if(process.platform === 'win32' && parseFloat(os.release(), 10) > 6.1 && width && height) {
        // win.setMaximumSize(Math.round(width), Math.round(height));
        // win.setMaximumSize(screen.width, screen.height);
    }
}

var enableSetFullScreenWindowResizing = false;

function setFullScreen(enter){
    console.warn('setFullscreen()', enter);
    if(!enter){
        inFullScreen = miniPlayerActive = false;
        doAction('miniplayer-off');
        win.leaveKioskMode(); // bugfix, was remembering to enter fullscreen irreversibly
        win.leaveFullscreen();
        if(enableSetFullScreenWindowResizing){
            var s = initialSize();
            if(document.readyState.indexOf('in')==-1){
                maxPortViewSize(screen.availWidth + 15, screen.availHeight + 14);
            } else {
                maxPortViewSize(s.width, s.height);						
            }
            centralizedResizeWindow(s.width, s.height, false)
        }
        // console.log('SIZE', s.width, s.height);
        if(typeof(window['fixMaximizeButton'])=='function'){
            fixMaximizeButton()
        }
    } else {
        inFullScreen = true;
        maxPortViewSize(screen.width + 1, screen.height + 1);
        if(useKioskForFullScreen){
            win.enterKioskMode() // bugfix, was remembering to enter fullscreen irreversibly
        } else {
            win.enterFullscreen()
        }
        notify(Lang.ESC_TO_EXIT, 'fa-info-circle', 'normal');
        if(Playback.active){
            Menu.hide()
        } else {
            Menu.show()
        }
    }
    var f = function (){
        var _fs = isFullScreen();
        win.setAlwaysOnTop(_fs || miniPlayerActive);
        win.requestAttention(_fs);
        if(_fs) {
            win.blur();
            win.focus()
        }
    }
    setTimeout(f, 500);
    setTimeout(f, 1000);
    setTimeout(f, 2000);
    win.show()
}

function restoreInitialSize(){
    console.warn('restoreInitialSize()');
    $body.add(getFrame('overlay').document.body).removeClass('miniplayer');
    setFullScreen(false)
}

function centralizeWindow(w, h){
    console.warn('centralizeWindow()');
    var x = Math.round((screen.availWidth - (w || window.outerWidth)) / 2);
    var y = Math.round((screen.availHeight - (h || window.outerHeight)) / 2);
    //window.moveTo(x, y)
    win.x = x;
    win.y = y;
    console.log('POS', x, y);
}

function verinf(){
    return applyFilters('verinf', '')
}

function sendStats(action, data){
    if(!data){
        data = {}
    }
    data.uiLocale = getLocale(false, false);
    data.arch = (process.arch == 'ia32') ? 32 : 64;
    data.ver = installedVersion || 0;
    data.verinf = verinf();
    if(data.source && !isListSharingActive() && getSourcesURLs().indexOf(data.source) != -1){
        console.warn('Source URL not shareable.');
        data.source = '';
    }
    var postData = jQuery.param(data);
    var options = {
        hostname: 'app.megacubo.net',
        port: 80,
        path: '/stats/'+action,
        family: 4, // https://github.com/nodejs/node/issues/5436
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData),
            'Cache-Control': 'no-cache'
        }
    }
    console.log('sendStats', options, postData, traceback());
    var req = http.request(options, function (res){
        res.setEncoding('utf8');
        var data = '';
        res.on('data', function (d){
            data += d;
        });
        res.on('end', function (){
            console.log('sendStats('+action+')', data);
        });
    });    
    req.on('error', (e) => {
        console.log('Houve um erro', e);
    });
    req.write(postData);
    req.end()
}

function sendStatsPrepareEntry(stream){
    if(!stream || typeof(stream)!='object'){
        stream = {}
    }
    if(typeof(stream.source)!='undefined' && stream.source){
        stream.source_nam = getSourceMeta(stream.source, 'name');
        stream.source_len = getSourceMeta(stream.source, 'length');
        if(isNaN(parseInt(stream.source_len))){
            stream.source_len = -1; // -1 = unknown
        }
    }
    return stream;
}

var autoCleanHintShown = false;
patchMaximizeButton();

jQuery(() => {
    console.log('SET ')
    nw.Window.get().on('close', closeApp);
    jQuery("#menu-trigger").on('click', (e) => {
        Menu.show();
        e.preventDefault(); // don't pause on clicking
        e.stopPropagation()
    })
    console.log('SET ')
})

win.on('new-win-policy', function(frame, url, policy) {
    if(url.substr(0, 19) != 'chrome-extension://'){
        policy.ignore() // IGNORE = BLOCK
        console.log('POPUP BLOCKED', frame, url, policy);    
        // CHECK AFTER IF IT'S A RELEVANT POPUP
        setTimeout(() => {
            shouldOpenSandboxURL(url, function (url){
                document.querySelector('iframe#sandbox').src = url;
            })
        }, 0)
    } else {
        policy.forceNewWindow();
        setNewWindowManifest({show: false})
    }
})

win.on('restore', () => {
    fixMaximizeButton() // maximize icon disappearing on unminimize
})

win.on('close', () => {
    precloseApp();
    closeApp(true) // force parameter needed to avoid looping
})

var preClosingWindow = false, closingWindow = false;

function killCrashpad(){    
    var ps = require('ps-node')
    ps.lookup({
        command: 'megacubo',
        arguments: 'crashpad'
    }, (err, resultList ) => {
        if (err) {
            throw new Error( err );
        }    
        console.warn('KILLING', resultList)
        resultList.forEach(( process ) => {
            if( process ){
                console.log( 'PID', process.pid );
                ps.kill(process.pid, ( err ) => {
                    if (err) {
                        throw new Error( err );
                    } else {
                        console.log( 'Crashpad unloaded!', process.pid );
                    }
                })
            }
        })
    })
}

// addAction('appUnload', () => {
//    setTimeout(killCrashpad, 0)
// })

var $tray = false;

function showInTray() {
    if(!$tray){
        doAction('beforeTray');
        var nm = applyFilters('appTrayTitle', appName());
        $tray = new nw.Tray({
            title: nm, 
            icon: 'default_icon.png', 
            click: () => {
                restoreFromTray()
            }
        });
        $tray.on('click', restoreFromTray);
        var menu = new nw.Menu();
        menu.append(new nw.MenuItem({
            label: nm,
            click: restoreFromTray
        }));
        menu.append(new nw.MenuItem({
            label: Lang.CLOSE,
            click: () => {
                removeFromTray();
                closeApp(true)
            }
        }));
        $tray.menu = menu;
        $tray.tooltip = nw.App.manifest.window.title;
    }
}

function closeToTray(keepPlayback) {
    if(!$tray || isMiniPlayerActive){
        if(keepPlayback !== true){
            Playback.fullStop()
        }
        if(!$tray){
            showInTray()
        }
        win.hide()
    }
}

function removeFromTray(){
    if($tray){
        $tray.remove();
        $tray = false;
        win.setShowInTaskbar(true)
    }
}

function restoreFromTray(){
    win.show();
    if($tray){
        removeFromTray()
    }
    if(isMiniPlayerActive){
        setFullScreen(false)
    }
}

nw.App.on('open', restoreFromTray);
nw.App.on('open', restoreFromTray);

addAction('miniplayer-on', showInTray);
addAction('miniplayer-off', removeFromTray);
addAction('appUnload', removeFromTray);

function fixLocalStateFile(){
    var file = nw.App.dataPath;
    if(basename(file)=='Default'){
        file = dirname(file)
    }
    file += '\\Local State';
    console.log('fixLocalStateFile()', file);
    if(fs.existsSync(file)){
        var content = fs.readFileSync(file);
        console.log('fixLocalStateFile()', content);
        if(content){
            var j = JSON.parse(content);
            if(j && typeof(j['profile'])!='undefined'){
                j['profile']['info_cache'] = {}
                content = JSON.stringify(j);
                if(content){
                    console.log('fixLocalStateFile() SUCCESS');
                    fs.writeFileSync(file, content)
                } else {
                    console.log('fixLocalStateFile() ERR');
                    fs.unlink(file)
                }
            } else {
                console.log('fixLocalStateFile() ERR');
                fs.unlink(file)
            }
        }
    }
    console.log('fixLocalStateFile() OK');
}

function minimizeCallback() {
    console.log('Window is minimized');
    if(isMiniPlayerActive()){
        removeFromTray()
    } else if(!isModal()){
        restoreInitialSize()
        enterMiniPlayer()
    }
}

function logoLoad(image, name){
    fetchSharedListsSearchResults(entries => {
        var check = () => {
            var entry = entries.shift()
            checkImage(entry.logo, () => {
                image.src = entry.logo
            }, check)
        }
        check()
    }, 'live', name, true, true)
}

var notificationVolume = notify('...', 'fa-volume-up', 'forever', true);
notificationVolume.hide();

var tb = jQuery(top.document).find('body');

var notificationSeemsSlow;

function seemsSlow(){
    if(Playback.active){
        var t = '', minDelay = 30000 /* ms */, lastNtfTime = 0, s = time(), clientSpeed = window.navigator.connection.downlink || 0, streamSpeed = currentBitrate ? (currentBitrate / 1024 / 1024) : averageStreamingBandwidth();
        if(s >= (lastNtfTime + (minDelay / 1000))){
            lastNtfTime = s;
            if((clientSpeed * 0.9) <= streamSpeed){
                t += Lang.SLOW_CLIENT;
            } else {
                t += Lang.SLOW_SERVER;
            }
            if(playingStreamKeyword(Playback.active)) { // can switch
                t += ', ' + Lang.SLOW_SERVER_CLIENT_HINT.format(hotkeysActions['PLAYALTERNATE'][0])
            }
            if(!notificationSeemsSlow){
                notificationSeemsSlow = notify(t, 'fa-wifi', 'normal', true)
            } else {
                notificationSeemsSlow.update(t, 'fa-wifi', 'normal')
            }
        }
    }
}

var pendingStateTimer = 0, defaultTitle = '', pendingStateNotification;

function inPendingState() {
    return top ? (top.isPending || false) : false;
}

function pendingStateFlags() {
    return [Lang.CONNECTING, Lang.TUNING]
}

function enterPendingState(title, notifyFlag, loadingUrl) {
    console.warn('enterPendingState', time(), top.isPending, loadingUrl || false, traceback(), Playback.log());
    var t = top || parent || window;
    t.isPending = loadingUrl || ((t.isPending && typeof(t.isPending)=='string') ? t.isPending : true);
    t.isPendingFlag = notifyFlag || t.isPendingFlag || Lang.CONNECTING;
    console.warn('enterPendingState', top.isPending);
    if(!title){
        title = t.isPendingFlag + '...';
    } else {
        title = t.isPendingFlag + ' ' + title + '...';
    } 
    //setTitleFlag('fa-circle-notch pulse-spin', title);
    if(!pendingStateNotification){
        //pendingStateNotification = notify(notifyFlag+'...', 'fa-circle-notch pulse-spin', 'forever')
        pendingStateNotification = notify(title, 'fa-circle-notch pulse-spin', 'forever')
    } else {
        //pendingStateNotification.update(notifyFlag+'...', 'fa-circle-notch pulse-spin')
        pendingStateNotification.update(title, 'fa-circle-notch pulse-spin', 'forever')
    }
    t.updateStreamEntriesFlags();
    jQuery(t.document.querySelector('body')).addClass('tuning')
}

function leavePendingState() {
    console.warn('leavePendingState', time(), top.isPending);
    var t = top || parent || window;
    if(typeof(t.isPending) != 'undefined'){
        t.isPending = false;
        //setTitleFlag('', defaultTitle);
        t.updateStreamEntriesFlags()
    }
    if(pendingStateNotification){
        pendingStateNotification.hide()
    }
    jQuery(t.document.querySelector('body')).removeClass('tuning')
}

function mergeThemeDefaults(to, defaults){
    defaults = Object.assign(defaults, to['defaults'] || {});
    var ndefs = {}
    for(var key in defaults){
        if(key != 'defaults' && defaults[key] != to[key]){
            ndefs[key] = defaults[key];
            if(typeof(to[key]) == 'undefined'){
                to[key] = defauls[key]
            } 
        }
    }
    to['defaults'] = ndefs;
    return to;
}

function mergeThemeAtts(to, atts){
    var odefs = Object.assign({}, to['defaults'] || {});
    to['defaults'] = {}
    Object.keys(atts).forEach(key => {
        if(key != 'defaults' && atts[key] != to[key]){
            if(typeof(odefs[key]) == 'undefined' && typeof(to[key]) != 'undefined'){
                odefs[key] = to[key];
            }
            to[key] = atts[key];
            if(typeof(odefs[key]) == 'undefined'){
                odefs[key] = to[key];
            }
        }
    });
    Object.keys(odefs).forEach(key => {
        if(key != 'defaults' && odefs[key] != to[key]){
            to['defaults'][key] = odefs[key];
        }
    })
    return to;
}

function commitThemeDefaults(to){
    if(typeof(to['defaults']) == 'object' && to['defaults']){
        Object.keys(to['defaults']).forEach(key => {
            to[key] = to['defaults'][key];
        })
    }
    to['defaults'] = {}
    return to;
}

function exportTheme(file, cb) {
    var data = Theme.data;
    data.name = basename(file || 'untitled').replaceAll(' ', '-').replaceAll('.theme.json', '').replaceAll('.json', '')
    fs.writeFile(file, JSON.stringify(data, null, 3), cb)
}

function importTheme(data, fileOrName, activate){
    if(typeof(data.name) != 'string' || typeof(Theme.themes()[data.name]) != 'undefined'){
        data.name = basename(fileOrName || 'Unknown').replaceAll('.theme.json', '').replaceAll('.json', '')
    }
    var themes = Theme.themes();
    console.warn('IMPORT', data.name, themes[data.name]);
    themes[data.name] = mergeThemeDefaults(data, themes[data.name] || {});
    console.warn('IMPORT', themes, data);
    Theme.themes(themes);
    if(activate === true){
        Theme.activate(data.name);
    }
    return themes[data.name];
}

function importThemeFile(file, cb) {
    copyFile(file, nfile, () => {

    })
	fs.readFile(file, (err, content) => {
		var data = JSON.parse(content);
		if(typeof(data)=='object' && data != null){
            importTheme(data, file, true);
            if(typeof(cb) == 'function'){
                cb()
            }
		}
	})
}

function saveThemeImages() {
    var l = Theme.get('logo');
    if(l) {
        base64ToFile(l, 'default_icon.png')
    }
    var l = Theme.get('background-image');
    if(l) {
        base64ToFile(l, 'assets/images/wallpaper.png')
    }
}

function resetTheme(cb){
    doAction('resetTheme');
    Theme.reset(() => {
        loadTheming(null, cb)
    })
}

function exportConfig(file, cb){
	fs.writeFile(file, JSON.stringify(Config.getAll(), null, 3), cb)
}

function importConfig(file, cb){
	fs.readFile(file, (err, content) => {
		var data = JSON.parse(content);
		if(typeof(data)=='object' && data != null){
			for(var key in data){
				Config.set(key, data[key])
            }
            if(typeof(cb) == 'function'){
                cb()
            }
		}
	})
}

function resetUserConfig(){
    if(confirm(Lang.RESET_CONFIRM)){
        doAction('resetUserConfig');
        removeFolder('torrent', false, () => {
            removeFolder(Store.folder, false, () => {
                resetTheme(() => {                    
                    fs.unlink(Config.file, (err) => {
                        nw.App.clearCache()
                        top.location.reload()
                    })
                })
            })
        })
    }
}

function resetConfig(){
    if(confirm(Lang.RESET_CONFIRM)){
        doAction('resetConfig')
        removeFolder('torrent', false, () => {
            removeFolder(Store.folder, false, () => {
                var _root = dirname(GStore.folder)
                async.forEach(['Store', 'Cache', 'Users'], (name, callback) => {
                    removeFolder(_root + path.sep + name, false, () => {
                        callback()
                    })
                }, () => {
                    resetTheme(() => {                    
                        fs.unlink(Config.file, (err) => {
                            nw.App.clearCache()
                            top.location.reload()
                        })
                    })
                })
            })
        })
    }
}

function chameleonize(base64, cb){    
    getImageColorsForTheming(base64, (colors) => {
        Theme.set('background-image', "linear-gradient(to top, #000004 0%, "+colors.darkestColor+" 75%)");
        Theme.set('background-color', colors.darkestColor);
        Theme.set('font-color', colors.lightestColor);
        loadTheming(null, cb)
    })
}

function getThemeColors(){
    return JSON.stringify(Theme.data).match(new RegExp('#[A-Fa-f0-9]{6}', 'g')).getUnique()
}

function getImageColorsForTheming(file, cb){
    var ColorThief = require('@codemotion/color-thief')
    let s = new Image(), white = '#FFFFFF', black = '#000000';
    s.onload = () => {
        let colors = (new ColorThief()).getPalette(s, 18), lightColors = [], darkColors = [];
        if(jQuery.isArray(colors)) {
            colors.forEach((color) => {
                let hex = rgbToHex.apply(null, color), lvl = getColorLightLevel(hex);
                if(lvl <= 50){
                    darkColors.push(hex)
                } else if(lvl >= 50) {
                    lightColors.push(hex)
                }
            })
        }
        let darkestColor = arrayMin(darkColors),  lightestColor = arrayMax(lightColors);
        if(darkColors.indexOf(black) == -1){
            darkColors.push(black);
            if(!darkestColor) darkestColor = black;
        }
        if(lightColors.indexOf(white) == -1){
            lightColors.push(white);
            if(!lightestColor) lightestColor = white;
        }
        cb({
            darkColors: darkColors.getUnique(),
            lightColors: lightColors.getUnique(),
            darkestColor: darkestColor,
            lightestColor: lightestColor
        })
    }
    s.onerror = () => {
        cb({
            darkColors: [black],
            lightColors: [white],
            darkestColor: black,
            lightestColor: white
        })
    }
    s.crossOrigin = 'anonymous';
    s.src = file;
}

function applyLogoImage(file){    
    if(file){
        copyFile(file, 'default_icon.png');
        fileToBase64(file, (err, b64) => {
            var done = () => {
                Menu.go('', () => {
                    var path = optionsPath + '/' + Lang.APPEARANCE;
                    setTimeout(() => {
                        Menu.go(path, Menu.setBackToHome)
                    }, 100)
                })
            }
            console.warn("APPLY", err, b64);
            if(!err) {
                Theme.set("logo", b64);
                loadTheming()
            }
            done()
        })
    }
}

function applyBackgroundImage(file){  
    if(file){
        copyFile(file, 'assets/images/wallpaper.png');
        fileToBase64(file, (err, b64) => {
            var done = () => {
                Menu.go('', () => {
                    var path = optionsPath+'/'+Lang.APPEARANCE;
                    setTimeout(() => {
                        Menu.go(path, Menu.setBackToHome)
                    }, 100)
                })
            }
            if(!err) {
                Theme.set("background", b64);
                loadTheming()
            }
            done()
        })
    }
}

function base64ToFile(b64, file, cb) {
    var base64Data = b64.replace(/^data:(image|video)\/(jpe?g|png|mp4|webm);base64,/, "");
    fs.writeFile(file, base64Data, 'base64', (err) => {
        if(err){
            console.error(err)
        }
        if(typeof(cb) == 'function') {
            cb()
        }
    })
}

function imageBufferToBase64(content, extOrName, cb){    
    var type = '', ext = (getExt(extOrName) || extOrName);
    switch(ext){
        case 'png':
            type = 'image/png';
            break;
        case 'jpg':
        case 'jpeg':
            type = 'image/jpeg';
            break;
        case 'mp4':
            type = 'video/mp4';
            break;
        case 'webm':
            type = 'video/webm';
            break;
    }
    if(type){
        cb(null, 'data:'+type+';base64,'+content.toString('base64'))
    } else {
        var fragment = String(content).substr(0, 256);
        cb('Invalid format.', console.warn(fragment))
    }
}

function fileToBase64(file, cb){    
    fs.exists(file, (exists) => {
        if(exists) {
            fs.readFile(file, (err, content) => {
                if(err) {
                    cb('Failed to read file', '')
                } else {
                    imageBufferToBase64(content, file, cb)
                }
            })
        } else {
            cb('Failed to read file', '')
        }
    })
}

var packageQueue = Store.get('packageQueue') || [];
var packageQueueCurrent = Store.get('packageQueueCurrent') || 0;

var isOver, mouseOutGraceTime = 4000, miniPlayerMouseOutTimer = 0, miniPlayerMouseHoverDelay = 0, _b = $body;
var mouseMoveTimeout = () => {
    clearTimeout(miniPlayerMouseOutTimer);
    miniPlayerMouseOutTimer = setTimeout(() => {
        isOver = false;
        if(miniPlayerActive){
            _b.addClass('frameless') 
        }
        _b.off('mousemove', mouseMoveTimeout);
        let c = Playback.setStateContainers();
        if(c.hasClass('over')){
            setWindowOverClass(false);
            $win.trigger('appout')
        }
    }, mouseOutGraceTime)
}

var miniPlayerMouseOut = () => {
    if(!isOver){
        if(miniPlayerActive){
            _b.addClass('frameless');
            _b.off('mousemove', mouseMoveTimeout)
        }
        let c = Playback.setStateContainers();
        if(c.hasClass('over')){
            setWindowOverClass(false);
            $win.trigger('appout')
        }
    }
}

var menuDimensions = {x: 0, y: 0, width: 0, height: 0}, mousePos = {x: 0, y: 0}

function updateMenuDimensions() {
    var c = document.querySelector('#menu-wrapper');
    if(c) {
        var md = Object.assign(c.getBoundingClientRect());
        if(md.width){
            md.y = 0;
            md.top = 0;
            md.right = window.outerWidth;
            md.height = window.outerHeight;
            md.x = md.left = window.outerWidth - md.width;
            menuDimensions = md;
        }
    }
}

$win.on('resize', () => {
    setTimeout(updateMenuDimensions, 200)
})

addAction('appReady', () => {
    setTimeout(updateMenuDimensions, 200)
})

addAction('afterLoadTheming', () => {
    setTimeout(updateMenuDimensions, 50)
})

addAction('menuShow', () => {
    setTimeout(updateMenuDimensions, 50)
})

addAction('menuShow', () => {
    setTimeout(() => {
        if(Config.get('resume') && !Playback.intents.length && Menu.path == ''){
            playResume()
        }
    }, 5000)
})

function isOverMenu() {
    return menuDimensions && (mousePos.x >= menuDimensions.x && mousePos.x <= (menuDimensions.x + menuDimensions.width)) && 
            (mousePos.y >= menuDimensions.y && mousePos.y <= (menuDimensions.y + menuDimensions.height))
    //return menuDimensions && (mousePos.x >= menuDimensions.x && mousePos.x <= (menuDimensions.x + menuDimensions.width)) && 
    //    (mousePos.y >= menuDimensions.y && mousePos.y <= (menuDimensions.y + menuDimensions.height))
}

function isOverPlayerControls() {
    return (Playback.active && mousePos.y >= (document.body.clientHeight * 0.75))
}

var menuEntered = false, updateWindowOverClassState;

function setWindowOverClass(state) {
    return updateWindowOverClass(state)
}

function updateWindowOverClass(state) {
    var b = $body, p = getFrame('player'), o = getFrame('overlay');
    if(p && p.document && p.document.body){
        b = b.add(p.document.body)
    }
    if(o && o.document && o.document.body){
        b = b.add(o.document.body)
    }
    if((b.hasClass('over') && state !== false) || state === true){
        var c = 'over', r = '', pl = !menuEntered && isOverPlayerControls();
        if(pl){
            c += ' over-vcontrols';
        } else {
            r += ' over-vcontrols';
        }
        if(!pl && isOverMenu()){
            // console.log('ZZZZ', 'menuEntered = true;');
            menuEntered = true;
            c += ' over-menu';
        } else {
            // console.log('ZZZZ', 'menuEntered = false;');
            menuEntered = false;
            r += ' over-menu';
        }
        if(Theme.get('menu-margin')){
            c += ' has-menu-margin';
        } else {
            r += ' has-menu-margin';
        }
        var s = c + '|' + r + '|' + window.outerWidth;
        if(s != updateWindowOverClassState || !b.hasClass('over')){
            updateWindowOverClassState = s;
            // console.log('C', c, 'R', r);
            if(r){
                b.removeClass(r)
            }
            if(c){
                b.addClass(c);
                updateMenuDimensions()
            }
        }
    } else {
        // console.log('ZZZZ', 'menuEntered = false;');
        menuEntered = false;
        b.removeClass('over over-vcontrols over-menu')
    }
}

function attachMouseObserver(win){
    if(!win || !win.document){
        console.error('Bad observe', win, win.document, traceback())
        return;
    }
    if(!win.document.documentElement){
        console.log('Delaying observe creation...', win);
        setTimeout(() => {
            attachMouseObserver(win)
        }, 1000);
        return;
    }
    var x = 0, y = 0, showing = false, margin = 6, v = false, t = 0, ht = 0, jw = jQuery(win), tb = jQuery(document).find('body');
    try {
        var w = jw.width();
        var h = jw.height();
        var b = jw.find('body');
        jQuery(win.document).on('mousemove', (e) => {
            top.mousePos.x = x = e.pageX;
            top.mousePos.y = y = e.pageY;
            if(isOver) {
                top.updateWindowOverClass();
                return;
            } 
            if(typeof(menuTriggerIconTrigger)!='undefined') {
                clearTimeout(menuTriggerIconTrigger)
            }
            isOver = true;
            let c = Playback.setStateContainers();
            if(!c.hasClass('over')) {
                setWindowOverClass(true);
                $win.trigger('appover')
            } else {
                top.updateWindowOverClass()
            }
            menuTriggerIconTrigger = setTimeout(() => {
                isOver = false;
                let c = Playback.setStateContainers();
                if(c.hasClass('over')){
                    setWindowOverClass(false);
                    $win.trigger('appout')
                }
            }, mouseOutGraceTime) // idle time before hide
        });
        var frames = win.document.querySelectorAll('iframe, frame');
        for(var i=0; i<frames.length; i++){
            if(frames[i].offsetWidth >= (w - 40)){
                attachMouseObserver(frames[i].contentWindow)
            }
        }
        setupEventForwarding(win.document)
    } catch(e) {
        console.error(e)
    }
}

function ptbTryOther(){
    jQuery('.try-other')[(Playback.active && playingStreamKeyword(Playback.active))?'show':'hide']()
}

$body.on('mouseenter mousemove', () => {
    isOver = true;
    if(!top.isFullScreen()){
        _b.removeClass('frameless')
    }
    let c = Playback.setStateContainers();
    if(!c.hasClass('over')){
        setWindowOverClass(true);
        $win.trigger('appover')
    }
    if(miniPlayerActive){
        _b.on('mousemove', mouseMoveTimeout)
    }
    fixMaximizeButton();
    mouseMoveTimeout()
}).on('mouseleave', () => {
    isOver = false;
    clearTimeout(miniPlayerMouseHoverDelay);
    miniPlayerMouseHoverDelay = setTimeout(miniPlayerMouseOut, 2000)
});

function detectKeys(currentKey, currentAction, cb){
    var dw = getFrame('detect-keys')
    dw.nextCallback = (keys) => {
        setTimeout(() => {
            jQuery('#detect-keys').hide();
            jQuery('.nw-cf').css('background', 'transparent');
            if(keys != currentKey){
                notify(Lang.SHOULD_RESTART, 'fa-cogs faclr-yellow', 'normal')
            }
        }, 750);
        cb(keys)
    }
    jQuery('#detect-keys').show();
    jQuery('.nw-cf').css('background', '#000000');
    dw.document.querySelector('#action').innerHTML = currentAction;
    dw.document.querySelector('#message').innerHTML = Lang.CHANGE_HOTKEY_MESSAGE.format(currentKey);
    dw.focus()
}

function hideSeekbar(state){
    var e = jQuery('#vcontrols .video-seek input');
    if(state){
        e.hide()
    } else {
        e.show()
    }
}

function overlayedMenu(state){
    var b = $body;
    if(state){
        b.addClass('transparent-menu')
    } else {
        b.removeClass('transparent-menu')
    }
}

function setHasMenuMargin(state){
    var b = $body;
    //console.warn('XXXX', b, state);
    if(state){
        b.addClass('has-menu-margin')
    } else {
        b.removeClass('has-menu-margin')
    }
}

$win.on('restore', restoreInitialSize);
$win.on('unload', function (){
    Store.set('packageQueue', packageQueue, true)
    Store.set('packageQueueCurrent', packageQueueCurrent, true)
})

function applyResolutionLimit(x, y){
    console.warn('RESIZERR', x, y);
    if(typeof(x) != 'number' || typeof(y)!='number'){
        x = win.width, y = win.height;
    }
    console.warn('RESIZERR', x, y);
    let css, res = Config.get("resolution-limit");
    if(res){
        res = res.match(new RegExp('^([0-9]{3,4})x([0-9]{3,4})$'))
    }
    if(!jQuery.isArray(res)){
        res = ['1280x720', 1280, 720]
    }
    var pch = y / (x / 100);
    res[2] = pch * (res[1] / 100);
    var s = x / res[1];
    console.warn('RESIZERR', s, pch, res[1], res[2]);
    if(x >= res[1] || y >= res[2]) {
        css = " \
    html { \
    width: "+res[1]+"px; \
    height: "+res[2]+"px; \
    transform: scale("+s+"); \
    transform-origin: 0 0; \
    } \
";
        console.warn('RESIZERR', css);
        stylizer(css, 'res-limit', window)
    } else {
        stylizer('', 'res-limit', window)
    }
}

var miniPlayerWidthTrigger = 400, miniPlayerHeightTriggerMinLimit = 380;

jQuery(() => {
    Playback.on('commit', ptbTryOther);
    Playback.on('commit', leavePendingState);
    var jDoc = jQuery(document), els = jDoc.add('html, body');
    var r = () => {
        var miniPlayerTriggerHeight = (screen.height / 2), width = $win.width(), height = $win.height(), showInTaskbar = ( height > miniPlayerTriggerHeight && width > miniPlayerWidthTrigger), onTop = ( !showInTaskbar || isFullScreen());
        if(miniPlayerTriggerHeight < miniPlayerHeightTriggerMinLimit){
            miniPlayerTriggerHeight = miniPlayerHeightTriggerMinLimit;
        }
        console.log('ONTOP', height + ' < ( '+screen.height+' / 3) )', onTop, showInTaskbar);
        if(!appShown || onTop !== lastOnTop){
            lastOnTop = onTop;
            console.log('SET ' + JSON.stringify(onTop));
            setTimeout(() => {
                console.log('SET ' + JSON.stringify(onTop))
                var b = $body;
                if(onTop){
                    b.addClass('frameless');
                } else {
                    b.removeClass('frameless');
                }
                if(showInTaskbar){
                    miniPlayerActive = false;
                    doAction('miniplayer-off')
                } else {
                    miniPlayerActive = true;
                    doAction('miniplayer-on')
                }
                console.log('SET ' + JSON.stringify(onTop))
            }, 50)
        }    
        win.setAlwaysOnTop(!!onTop)  
    }
    jDoc.on('shown', () => {
        setTimeout(() => {
            $win.on('resize load', r);
            r()
        }, 2000);
        r()
    })
    console.log('FINE HERE', traceback())
    var recordingJournal = [], recordingJournalLimit = 8;
    addAction('media-save', (url, content, type) => { // prepare and remove dups from recording journal
        if(typeof(content) != 'undefined' && shouldCapture()){
            var length, filePath = null;
            console.log('recording, media received', typeof(content));
            if(typeof(content)=='object' && typeof(content.base64Encoded)!='undefined' && content.base64Encoded){ // from chrome.debugger
                console.log('recording, media received', typeof(content));
                if(['frame', 'ts'].indexOf(Playback.active.type) == -1){ // only in frame intent we receive from chrome.debugger now
                    console.log('recording, media received', typeof(content));
                    return;
                }
                content = Buffer.from(content.body, 'base64');
                length = content.byteLength; 
            } else if(type == 'path'){ // so content is a path, not a buffer
                filePath = content;
                length = fs.statSync(filePath).size; 
            } else {
                length = (typeof(content)=='string') ? content.length : content.byteLength; 
            }
            if(!length) { // discard empty media
                console.warn('Empty media skipped.');
                return;
            }
            for(var key in recordingJournal){
                if(length && recordingJournal[key] == length){
                    console.log('Duplicated media skipped.');
                    // !!!!! TODO: Compare deeper if the files are really the same.
                    return;
                }
            }
            var ext = getExt(url);
            if(['ts', 'mpg', 'webm', 'ogv', 'mpeg', 'mp4'].indexOf(ext) == -1){
                ext = 'mp4';
            }
            var file = capturingFolder + '/' + time() + '.' + ext;
            recordingJournal[file] = length;
            recordingJournal = sliceObject(recordingJournal, recordingJournalLimit * -1);
            var cb = (err) => {
                if(err){
                    console.error('Failed to save media.')
                }
                doAction('media-received', url, file, length)
            }
            if(type == 'path'){ // so content is a path, not a buffer
                copyFile(filePath, file, cb)
            } else {    
                fs.writeFile(file, content, {encoding: 'binary', flag: 'w'}, cb)
            }
            console.log('Media processed.', url, file, length)
        }
    })   
    console.log('FINE HERE', traceback())
    var player = document.getElementById('player'), playerSizeUpdated = (() => {
        var lastSize, timer = 0;
        return () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                var s = player.offsetWidth+'x'+player.offsetHeight;
                //console.log('player size updated?', s, lastSize);
                if(s != lastSize){
                    lastSize = s;
                    videoObserver.disconnect();
                    //console.log('player size updated', player.offsetWidth, player.offsetHeight);
                    if(Playback.active){
                        Playback.setRatio()
                    }
                    updateMenuLeftBorderPos();
                    //console.log('player size reobserve', player.offsetWidth, player.offsetHeight);
                    videoObserver.observe(player)
                }
            }, 50)
        }
    })(), videoObserver = new ResizeObserver(playerSizeUpdated);
    videoObserver.observe(player)
    jQuery(document).on('scroll', () => {
        document.documentElement.scrollTop = document.documentElement.scrollLeft = 0; 
    })
    console.log('FINE HERE', traceback())
})

var updateMenuLeftBorderPos = (() => {
    var mT, mLb; 
    return (isHome) => {
        if(typeof(isHome) !== 'boolean'){
            isHome = !Menu.path;
        }
        if(!mT){
            mT = jQuery('#menu-toggle'), mLb = jQuery('#menu-left-border')
        }
        var t = mT.outerHeight(), l = mT.outerWidth();
        if($body.hasClass('has-menu-margin')){
            isHome = false; // the #menu-toggle is always at left in this case
        }
        if(isHome){
            l = 0;
        }
        mLb.css({height: (win.height - t)+'px', top: t + 'px'});
        mT.css({left: (l * -1)+ 'px'})
    }
})();

addAction('afterLoadTheming', updateMenuLeftBorderPos)
addAction('Menu.adjustBodyClass', (isHome) => { 
    updateMenuLeftBorderPos(isHome) 
})

function appDownloadUrl(){
    return 'https://megacubo.tv/online/?version='+nw.App.manifest.version;
}

function loadAddons(loadcb){
    console.log('Loading addons');
    var folder = 'addons';
    console.log('Loading addons from '+folder);
    fs.readdir(folder, (err, files) => {
        if (err) {
            console.error('Error reading directory ' + folder);
            loadcb()
        } else {
            async.forEach(files, (file, callback) => { 
                var lng = folder + path.sep + file + path.sep + 'lang';
                file = folder + path.sep + file + path.sep + file;
                try {
                    let cb = () => {
                        fs.exists(file + '.js', (exists) => {
                            if(exists){
                                console.log('LOAD JS '+file + '.js');
                                loadScript(file.replace(folder, 'addons') + '.js', callback)
                            } else {
                                fs.exists(file + '.bin', (exists) => {
                                    if(exists){
                                        console.log('LOAD BIN '+file + '.bin');
                                        win.evalNWBin(null, file + '.bin')
                                    } else {
                                        console.error('Addon without main file', file)
                                    }
                                    callback()
                                })
                            }
                        })
                    }
                    fs.exists(lng, (exists) => {
                        if(exists){
                            loadLanguage(getUserLocales(), lng, cb)
                        } else cb()
                    })
                } catch(e) {
                    console.error(e);
                    callback()
                }
            }, (err) => {
                loadcb()
            })
        }
    })
}

function loadLanguage(locales, folder, callback){
    var localeMask = path.resolve(folder) + path.sep + "{0}.json", locale = locales.shift(), next = () => {
        if(locales.length){
            loadLanguage(locales, folder, callback)
        } else {
            if(typeof(callback)=='function'){
                callback()
            }
        }
    }
    getLocalJSON(localeMask.format(locale), (err, content) => {
        console.log('GETLOCJSON', localeMask.format(locale))
        if(content && typeof(content)=='object'){
            Lang = Object.assign(content, Lang);
        }
        next()
    })
}

var ipc = require('node-ipc'), leftWindowDiff = 0, ipcIsClosing;
ipc.config.id = 'main';
ipc.config.socketRoot = Store.folder + path.sep;
ipc.serve(() => {
    // started
})
ipc.server.start()

var ipcSrvCloseTimer;

function ipcSrvClose(cb){
    var interval = 100; // ms
    if(ipc && ipc.server.server.listening){    
        if(ipcSrvCloseTimer){
            clearTimeout(ipcSrvCloseTimer)
        }
        ipc.server.stop()
        ipcSrvCloseTimer = setTimeout(() => {
            ipcSrvClose(cb)
        }, interval)
    } else {
        cb()
    }
}

function precloseApp(){
    if(!preClosingWindow){
        doAction('appUnload');
        preClosingWindow = true;
        fixLocalStateFile();
        console.warn('precloseApp()');
        stop()
    }
}

$win.on('beforeunload unload', precloseApp);

function closeApp(force){
    if(ipc && ipc.server.server.listening){        
        if(!ipcIsClosing){
            ipcIsClosing = true;
            ipcSrvClose(() => {
                ipc = false;
                closeApp(force)
            })
        }
        return;
    }
    var doClose = (force === true || applyFilters('closeApp', true))
    if(doClose){
        precloseApp()
        if(!closingWindow && force !== true){
            console.warn('CASE A');
            closingWindow = true;
            win.close()
        } else {
            console.warn('CASE B')
            // global.nw.Window.get().close(true)
            nw.App.closeAllWindows()
            console.warn('CASE B')
            nw.App.quit()
            // global.nw.App.quit()
            // win.close(true);  
            process.exit()          
        }
    }
}

function focusApp(){
    var top = win.isAlwaysOnTop
    if(!top){
        win.setAlwaysOnTop(true)
    }
    win.show()
    if(!top){        
        win.setAlwaysOnTop(false)
    }
}

var indexerVarsAvailable = false;

function initSearchIndex(_cb) {
    doAction('initSearchIndex')
    const cb = () => {
        if(typeof(_cb) == 'function'){
            _cb()
            _cb = null
        }
    }
    if(!indexerVarsAvailable){
        const applyVars = (data) => {
            if(!indexerVarsAvailable){
                indexerVarsAvailable = true;
                $body.addClass('indexed')
            }
            Object.keys(data).forEach(k => {
                window[k] = data[k]
            })
            if(jQuery('a.entry.search-index-vary').length){
                Menu.refresh()
            }
        }
        const events = {
            'indexer-load': () => {
                focusApp()
            },
            'indexer-vars': (data) => {
                console.warn('INDEXER', data)
                Store.set('indexer-vars', data, true)
                applyVars(data)
                cb()
            }
        }
        Object.keys(events).forEach(name => {
            ipc.server.on(name, events[name])
        })
        nw.Window.open('indexer.html', {
            new_instance: true,
            show_in_taskbar: false,
            transparent: true,
            frame: false,
            show: false
        })
        const lastVars = Store.get('indexer-vars')
        if(typeof(lastVars) == 'object' && lastVars){
            applyVars(lastVars)
        }
    } else {
        cb()
    }
}

enableSetFullScreenWindowResizing = true;
    
applyResolutionLimit();
win.on('resize', applyResolutionLimit)

addAction('appLoad', () => {
    hideSeekbar(Theme.get('hide-seekbar'))
    Menu.setup([
        {name: Lang.LIVE, homeId: 'live', labeler: parseLabelCount, logo:'fa-tv', class: 'entry-nosub search-index-vary', type: 'group', entries: [], renderer: getLiveEntries},
        {name: Lang.VIDEOS, homeId: 'videos', labeler: parseLabelCount, logo:'fa-film', class: 'entry-nosub search-index-vary', type: 'group', entries: [], renderer: getVideosEntries},
        {name: Lang.SEARCH, homeId: 'search', label: '', logo: 'fa-search', type: 'option', class: 'entry-hide entry-nosub search-index-vary', callback: () => { 
            var term = lastSearchTerm, n = Playback.active;
            if(n && n.entry.originalUrl && isMegaURL(n.entry.originalUrl)){
                var data = parseMegaURL(n.entry.originalUrl);
                if(data && data.type == 'play'){
                    term = data.name;
                }
            }
            setupSearch(term, lastSearchType || 'all')
        }},
        {name: Lang.BOOKMARKS, homeId: 'bookmarks', logo:'fa-star', type: 'group', renderer: getBookmarksEntries, entries: []},  
        {name: Lang.IPTV_LISTS, homeId: 'iptv_lists', label: Lang.MY_LISTS, class: 'entry-nosub', logo:'fa-list', type: 'group', entries: [], renderer: (data, element, isVirtual) => {
            return getListsEntries(false, false, isVirtual)
        }},
        {name: Lang.TOOLS, homeId: 'tools', logo:'fa-box-open', class: 'entry-nosub', callback: () => { timerLabel = false; }, type: 'group', entries: [], renderer: getToolsEntries},
        {name: Lang.OPTIONS, homeId: 'options', logo:'fa-cog', class: 'entry-nosub', callback: () => { timerLabel = false; }, type: 'group', entries: [], renderer: getSettingsEntries},
        {name: Lang.OPEN_FILE, append: getActionHotkey('OPENURLORLIST'), homeId: 'open_file', logo:'fa-folder-open', type: 'option', callback: () => {playCustomURL()}},
        {name: Lang.ABOUT, append: getActionHotkey('ABOUT'), homeId: 'about', logo:'fa-info-circle', type: 'option', callback: about},
    ])    
    soundSetup('warn', 16); // reload it
    var p = getFrame('player'), o = getFrame('overlay');
    p.init();
    attachMouseObserver(p);
    attachMouseObserver(o);
    attachMouseObserver(window);
    Pointer.setup();
    [
        ['modal', '#modal-overlay input, #modal-overlay textarea, #modal-overlay .button:visible, .prompt-close a', () => {
            return Pointer.body.hasClass('modal')
        }],
        ['entries', () => {
            return Menu.getEntries(false, true)
        }, () => {
            return !Pointer.body.hasClass('modal') && Menu.isVisible()
        }],
        ['nw-cf', 'button.nw-cf-btn:visible', () => {
            return !Pointer.body.hasClass('frameless')
        }],
        ['menu-toggle', '#menu-toggle', () => { 
            return !Pointer.body.hasClass('modal') && Menu.isVisible() 
        }],
        ['menu-trigger', '#menu-trigger', () => { 
            return !Pointer.body.hasClass('modal') && !Menu.isVisible() 
        }],
        ['player', '#vcontrols a:visible', () => { 
            return !Pointer.body.hasClass('modal') && Playback.active 
        }]
    ].forEach((args) => {
        Pointer.navigables(args[0], args[1], args[2], args[3] || false)    
    })
    doAction('preMenuInit')
    Menu.init(() => {
        var waitToRenderDelay = 1000, t = (top || window.parent); 
        setTimeout(() => { 
            jQuery(document).trigger('show');
            Menu.show();
            appShown = time();
            jQuery('#menu').show();
            $body.removeClass('frameless');
            jQuery(document).trigger('shown');
            var is = Config.get('initial-section');
            if(is){
                goHomeId(is, false)
            }
            setTimeout(() => {   
                doAction('appStart');
                Menu.show();
                $body.removeClass('splash');
                Menu.restoreScroll();
                doAction('appShow')
            }, 500)
        }, waitToRenderDelay)
    });
    setTimeout(jQuery.noop, 0); // tricky?!
    //console.log(jQuery('.list').html())
    handleOpenArguments(nw.App.argv)
})

function getDurationFromMediaInfo(nfo) {
    var dat = nfo.match(new RegExp('[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{2}'));
    return  dat ? hmsClockToSeconds(dat[0]) : 0;
}

function getFileBitrate(file, cb, length){
    var next = () => {
        getMediaInfo(file, (nfo) => {
            //console.warn('NFO', nfo);
            top.nfo = nfo;
            var secs = getDurationFromMediaInfo(nfo);
            if(secs){
                //console.warn('NFO', secs, length, length / secs);
                if(secs){
                    cb(null, parseInt(length / secs), file)
                } else {
                    cb('Failed to get duration for '+file, 0, file)
                }
            } else {
                cb('FFmpeg unable to process '+file, 0, file)
            }
        })
    }
    if(length){
        next()
    } else {
        fs.stat(file, (err, stat) => {
            if(err) { 
                cb('File not found or empty.', 0, file)
            } else {
                length = stat.size;
                next()
            }
        })
    }
}

var currentBitrate = 0, averageStreamingBandwidthData;

function averageStreamingBandwidth(data){
    if(!jQuery.isArray(averageStreamingBandwidthData)){
        averageStreamingBandwidthData = GStore.get('aver-bandwidth-data') || [];
    }
    if(!averageStreamingBandwidthData.length){
        return 0.5; // default
    } else {
        var sum = averageStreamingBandwidthData.reduce((a, b) => a + b, 0);
        var ret = (sum / averageStreamingBandwidthData.length) / 1000000;
        if(ret < 0.1) {
            ret = 0.1;
        } else if(ret > 2) {
            ret = 2;
        }
        return ret;
    }
}

function averageStreamingBandwidthCollectSample(url, file, length) {
    removeAction('media-received', averageStreamingBandwidthCollectSample); // once per commit
    getFileBitrate(file, (err, bitrate, file) => {
        if(err){
            console.error('Bitrate collect error', file)
        } else {
            currentBitrate = bitrate;
            if(!jQuery.isArray(averageStreamingBandwidthData)){
                averageStreamingBandwidthData = GStore.get('aver-bandwidth-data') || []
            }
            averageStreamingBandwidthData.push(bitrate);
            GStore.set('aver-bandwidth-data', averageStreamingBandwidthData, true)
        }
    }, length);
}

Playback.on('stop', () => {
    currentBitrate = 0;
});

Playback.on('commit', () => {
    addAction('media-received', averageStreamingBandwidthCollectSample)
});

addFilter('about', (txt) => {
    txt += Lang.DOWNLOAD_SPEED+': '+window.navigator.connection.downlink.toFixed(1)+"MBps\n";
    if(Playback.active && currentBitrate){
        txt += Lang.BITRATE+': '+(currentBitrate / 1024 / 1024).toFixed(1)+"MBps ("
        txt += Playback.active.type
        if(Playback.active.transcode){
            txt += ", transcode"
        }
        txt += ")\n";   
    } else {
        txt += Lang.AVERAGE_BITRATE+': '+averageStreamingBandwidth().toFixed(1)+"MBps\n";   
    }
    if(Playback.active) {
        var s = Playback.getVideoSize();
        if(s && s.width > 0) {
            txt += Lang.ORIGINAL_SIZE+': '+s.width+'x'+s.height+"\n";  
        } 
    }
    return txt;
})

function tuningConcurrency(){
    var downlink = window.navigator.connection.downlink || 5;
    var ret = Math.round(downlink / averageStreamingBandwidth());
    if(ret < 1){
        ret = 1;
    } else if(ret > 36) {
        ret = 36;
    }
    return ret;
}

function updateAutoCleanOptionsStatus(txt, inactive) {
    var _as = jQuery('a.entry-autoclean');
    if(_as.length){
        _as.find('.entry-name').html(txt);
        _as.find('.entry-label').html(inactive ? Lang.AUTO_TUNING : '<font class="faclr-red">'+Lang.CLICK_AGAIN_TO_CANCEL+'</font>');
    }
}

var autoCleanDomainConcurrencyLimit = 2, autoCleanDomainConcurrency = {}, autoCleanEntriesQueue = [], closingAutoCleanEntriesQueue = [], autoCleanEntriesStatus = '', autoCleanLastMegaURL = '', autoCleanReturnedURLs = [];

function autoCleanEntries(entries, success, failure, cancelCb, returnSucceededIntent, cancelOnFirstSuccess, megaUrl, name) {
    cancelOnFirstSuccess = true;
    if(autoCleanEntriesCancel()){
        updateAutoCleanOptionsStatus(Lang.TEST_THEM_ALL, true)
    }
    var succeeded = false, testedMap = [], readyIterator = 0, debug = debugAllow(true)
    if(!jQuery.isArray(entries)){
        var arr = []
        jQuery('a.entry-stream').each((i, o) => {
            var e = jQuery(o).data('entry-data');
            if(e){
                arr.push(e)
            }
        })
        entries = sortEntriesByState(arr)
    }
    if(!entries.length){
        if(typeof(failure)=='function'){
            setTimeout(() => {
                failure()
            }, 150)
        }
        return false;
    }
    entries = entries.filter((entry) => { 
        return parentalControlAllow(entry) 
    })
    entries = deferEntriesByURLs(entries, autoCleanReturnedURLs);
    if(!name && entries.length){
        name = basename(Menu.path)
    }
    if(debug){
        console.log('autoCleanSort', entries, entries.map((entry) => {return entry.sortkey+' ('+entry.url+')'}).join(", \r\n"))
    }
    autoCleanDomainConcurrency = {}
    var controller, iterator = 0, entriesLength = entries.length, pcs;
    autoCleanEntriesStatus = pcs = Lang.TUNING+' '+ucNameFix(name)+' ('+Lang.X_OF_Y.format(readyIterator, entriesLength)+')';
    updateAutoCleanOptionsStatus(autoCleanEntriesStatus);
    controller = {
        testers: [],
        cancelled: false,
        id: time(),
        cancel: () => {
            if(!controller.cancelled){
                if(debug){
                    console.warn('Autoclean cancel', tasks.length, controller.id)
                }
                console.log('cancelling', controller.testers);
                controller.cancelled = true;
                controller.testers.forEach((intent, i) => {
                    if(intent.shadow){ // not returned onsuccess
                        try {
                            intent.destroy()
                        } catch(e) {
                            console.error(e)
                        }
                    }
                });
                autoCleanEntriesStatus = '';
                updateAutoCleanOptionsStatus(Lang.TEST_THEM_ALL, true);
                if(!succeeded && typeof(cancelCb)=='function'){
                    cancelCb()
                }
                autoCleanEntriesRunning() // purge invalid controllers on ac queue
            }
        }
    }
    var tasks = Array(entriesLength).fill((callback) => {
        if(controller.cancelled){
            callback();
            return;
        }
        var entry, domain;        
        var select = () => {
            if(!controller.cancelled){
                if(!entry){
                    for(var i=0; i < entries.length; i++){
                        if(testedMap.indexOf(i) == -1){
                            domain = getDomain(entries[i].url);
                            if(typeof(autoCleanDomainConcurrency[domain]) == 'undefined'){
                                autoCleanDomainConcurrency[domain] = 0;
                            }
                            if(autoCleanDomainConcurrency[domain] >= autoCleanDomainConcurrencyLimit){
                                //console.warn('AutoClean domain throttled: '+domain);
                                continue;
                            } else {
                                testedMap.push(i);
                                entry = entries[i];
                                break;
                            }
                        }
                    }
                }
                if(entry){
                    if((entry.type && entry.type != 'stream') || (isMegaURL(entry.url) || !isTestable(entry))){
                        readyIterator++;
                        if(debug){
                            console.warn('Autoclean entry ignored', entry)
                        }
                        return callback() // why should we test?
                    }
                    if(debug){
                        console.log('Autoclean processing', entry.name, entry.url, entry, entries, controller.id)
                    }
                    process()
                } else {
                    setTimeout(select, 1000)
                }
            }
        }
        var process = () => {
            if(!controller.cancelled){
                autoCleanDomainConcurrency[domain]++;
                var sm = entry.originalUrl && isMegaURL(entry.originalUrl), originalUrl = entry.originalUrl && !sm ? entry.originalUrl : entry.url;
                pcs = ucNameFix(name) + ' ('+Lang.X_OF_Y.format(readyIterator, entries.length)+')';
                try {
                    if(!megaUrl && sm){
                        megaUrl = entry.originalUrl;
                    }
                    testEntry(entry, (succeededIntent) => {
                        if(controller.cancelled){
                            if(succeededIntent){
                                succeededIntent.destroy()
                            }
                            if(autoCleanDomainConcurrency[domain]){
                                autoCleanDomainConcurrency[domain]--;
                            }
                            return callback()
                        } else {
                            if(debug){
                                console.warn('Autoclean entry testing success', returnSucceededIntent, succeededIntent, entry, megaUrl, succeeded, controller.cancelled)
                            }
                            readyIterator++;
                            if(!succeeded){
                                succeeded = true;
                                if(megaUrl){
                                    entry.originalUrl = megaUrl;
                                }
                                if(megaUrl != autoCleanLastMegaURL){
                                    autoCleanLastMegaURL = megaUrl || '';
                                    autoCleanReturnedURLs = [];
                                }
                                if(autoCleanReturnedURLs.indexOf(entry.url) == -1){
                                    autoCleanReturnedURLs.push(entry.url)
                                }
                                if(succeededIntent){
                                    succeededIntent.shadow = false;
                                    if(megaUrl){
                                        succeededIntent.entry.originalUrl = megaUrl;
                                    }
                                }
                                if(returnSucceededIntent){
                                    if(cancelOnFirstSuccess){
                                        controller.cancel()
                                        if(debug){
                                            console.warn('Autoclean, cancelling after first success', entry.name, entry.url, succeeded, controller.cancelled, controller.id)
                                        }
                                    }
                                }
                                if(typeof(success)=='function'){
                                    console.warn('Autoclean success callback', megaUrl, entry, succeededIntent)
                                    success(entry, controller, succeededIntent)
                                }
                            }
                            if(cancelOnFirstSuccess){
                                if(returnSucceededIntent){
                                    autoCleanEntriesStatus = Lang.TEST_THEM_ALL;
                                } else {
                                    autoCleanEntriesStatus = Lang.TRY_OTHER_STREAM;
                                }
                            } else {
                                autoCleanEntriesStatus = Lang.TUNING+' '+pcs;
                            }
                            updateAutoCleanOptionsStatus(autoCleanEntriesStatus);
                            setStreamStateCache(entry, true);
                            updateStreamEntriesFlags();
                            sendStats('alive', sendStatsPrepareEntry(entry));
                            if(autoCleanDomainConcurrency[domain]){
                                autoCleanDomainConcurrency[domain]--;
                            }
                            callback()
                        }
                    }, () => {
                        if(controller.cancelled){
                            if(autoCleanDomainConcurrency[domain]){
                                autoCleanDomainConcurrency[domain]--;
                            }
                            return callback()
                        } else {
                            if(debug){
                                console.warn('Autoclean entry testing failure', entry.name, entry.url, succeeded, controller.cancelled, controller.id)
                            }
                            readyIterator++;
                            autoCleanEntriesStatus = Lang.TUNING+' '+pcs;
                            updateAutoCleanOptionsStatus(autoCleanEntriesStatus);
                            if(!succeeded){
                                enterPendingState(pcs, Lang.TUNING)
                            }                    
                            setStreamStateCache(entry, false);
                            updateStreamEntriesFlags();
                            if(autoCleanDomainConcurrency[domain]) {
                                autoCleanDomainConcurrency[domain]--;
                            }
                            callback();
                            if(debug){
                                console.warn('Autoclean reporting failure to server')
                            }
                            sendStats('error', sendStatsPrepareEntry(entry))
                        }
                    }, returnSucceededIntent, (intent) => {
                        console.log('ACE G', intent, entry);
                        controller.testers.push(intent)
                    });
                } catch(e) {
                    console.error('ACE ERROR CATCHED', e)
                }
            }
        }
        select()
    })
    console.log('Autoclean testers', controller.testers);
    autoCleanEntriesQueue.push(controller);
    setTimeout(() => {
        async.parallelLimit(tasks, tuningConcurrency(), (err, results) => {
            console.warn('Autoclean done', tasks.length);
            if(!controller.cancelled){
                controller.cancel();
                if(!succeeded && typeof(failure)=='function'){
                    setTimeout(failure, 150)
                }
                autoCleanEntriesStatus = Lang.AUTO_TUNING+' 100%';
                updateAutoCleanOptionsStatus(autoCleanEntriesStatus)
            }
        })
    }, 100);
    return controller;
}

function cancelCheckPlaybackHealth(forceClose){
    var has = hasAction('cancelCheckPlaybackHealth');
    if(typeof(forceClose) != 'boolean'){
        forceClose = !has;
    }
    if(has){
        doAction('cancelCheckPlaybackHealth');
        removeAction('cancelCheckPlaybackHealth')
    }
    if(forceClose === true){
        jQuery('#check-health').hide();
        jQuery('.nw-cf').css('background', '')
    }
}

function checkPlaybackHealth(_step, _cb, locale){
    stop()
    var cancel, entries = [], success = 0, fails = 0, failed = [], frame = getFrame('check-health'), transcode = Config.get('transcode-policy')
    if(transcode == 'always'){
        Config.set('transcode-policy', 'auto')
    }
    jQuery('#check-health').show();
    jQuery('.nw-cf').css('background', '#000000');
    frame.focus();
    var update = (a, b) => {
        frame.document.querySelector('#action').innerHTML = a;
        frame.document.querySelector('#message').innerHTML = b;
    }
    var step = (entry) => {
        if(entries && entries.length){
            update(
                '<i class="fas fa-circle-notch pulse-spin"></i> ' + Lang.PROCESSING + ' ' + parseInt((success + fails) / (entries.length / 100)) + '%', 
                Lang.SUCCESS_RATE + ': ' + parseInt((success + fails) ? success / ((success + fails) / 100) : 0) + '%'
            );
            if(typeof(_step) == 'function'){
                _step(success, fails, entries.length, entry)
            }
        }
    }
    var cb = () => {
        top.temp2 = failed
        if(transcode == 'always'){
            Config.set('transcode-policy', transcode)
        }
        console.warn('DIAGNOSTIC DONE', success, fails);
        var states = {
            'BAD': '<span style="color: #960316;">' + Lang.BAD + '</span>',
            'REGULAR': '<span style="color: #c17600;">' + Lang.REGULAR + '</span>',
            'GOOD': '<span style="color: #01791c;">' + Lang.GOOD + '</span>',
            'VERY_GOOD': '<span style="color: #01791c;">' + Lang.VERY_GOOD + '</span>'
        }
        var s = '', p = parseInt(success / ((success + fails) / 100)), state = p <= 40 ? 'BAD' : (p <= 60 ? 'REGULAR' : (p <= 80 ? 'GOOD' : 'VERY_GOOD'));
        var clientSpeed = window.navigator.connection.downlink || 0, streamSpeed = averageStreamingBandwidth();
        s += Lang['DIAG_DESC_'+state] + '<br />';
        if(['BAD', 'REGULAR'].indexOf(state) != -1){
            s += Lang['DIAG_DESC_'+(((clientSpeed * 0.9) > streamSpeed) ? 'CPU' : 'SPEED')] + '<br />';
        }
        s += Lang.ESC_TO_EXIT;
        update(
            Lang.SUCCESS_RATE + ': ' + p + '% &middot; ' + states[state],
            s
        );
        if(typeof(_cb) == 'function'){
            _cb(success, fails, entries.length);
            _cb = null; // once
        }
        stop()
    }
    var process = (es) => {
        entries = es.slice(0, 50)
        console.warn('ENTRIES', es);
        var iterator = 0, process = (callback) => {
            if(cancel){
                callback()
            } else {
                var entry = entries[iterator];
                iterator++;
                if(entry){
                    step(entry);
                    testEntry(entry, () => { 
                        success++; 
                        callback() 
                    }, () => { 
                        fails++; 
                        failed.push(entry)
                        console.warn('Playback failed', entry)
                        callback() 
                    }, false)
                } else {
                    cb();
                    cancelCheckPlaybackHealth(false);
                    callback()
                }
            }
        }
        async.parallelLimit(new Array(entries.length).fill(process),  tuningConcurrency(), cb)
    }
    addAction('cancelCheckPlaybackHealth', () => {
        cancel = true;
        cb(success, fails)
    })
    getWatchingData((es) => {
        if(!es || es.length < 10){
            getWatchingData(process, true, 'pt') //'en')
        } else {
            process(es)
        }
    }, true)
}

function tune(entries, name, originalUrl, cb, type){ // entries can be a string search term
    console.log('TUNE ENTRIES', entries);
    var nentries;
    if(typeof(entries)=='string'){
        if(!name){
            name = entries;
        }
        console.warn('KKKKKKKKKKK', type || 'all');
        const terms = entries
        fetchSharedListsSearchResults(entries => {
            tune(entries, name, originalUrl, cb, type)
        }, type || 'all', terms, 'auto', true)
        return;
    }
    var failure = (msg) => {
        cb(msg, false, false)
    }
    console.log('TUNE ENTRIES', entries);
    if(!entries.length){
        return failure(Lang.PLAY_STREAM_FAILURE.format(name))
    }
    if(!name){
        name = entries[0].name;
    }
    // parse mega:// entries
    var expands = {}
    entries.forEach((entry, i) => {
        if(isMegaURL(entry.url)){ // mega://
            // console.log('isMega');
            expands[i] = expandMegaURL(entry.url);
        }
    })
    if(Object.keys(expands).length){
        nentries = [];
        for(var i=0; i<entries.length; i++){
            if(typeof(expands[i]) != 'undefined'){
                nentries = nentries.concat(expands[i])
            } else {
                nentries.push(entries[i])
            }
        }
        expands = null;
        entries = nentries;
        nentries = null;
    }
    entries = sortEntriesByState(entries);
    console.log('TUNE ENTRIES 2', entries);
    if(autoCleanEntriesRunning()){
        autoCleanEntriesCancel()
    }
    var hr = autoCleanEntries(entries, (entry, controller, succeededIntent) => {
        controller.cancel();
        console.log('tune SUCCESS', succeededIntent, entry);
        if(succeededIntent) {
            succeededIntent.manual = true;
            succeededIntent.shadow = false;
            succeededIntent.entry = entry;
            cb(null, entry, succeededIntent)
        } else {
            cb(null, entry, false)
        }
    }, () => {
        console.warn('tune FAILED', entries.length, traceback());
        failure(Lang.PLAY_STREAM_FAILURE.format(name))
    }, () => {
        // CANCELLED
    }, true, true, originalUrl, name);
    if(hr){
        console.log('tuning OK');
    } else {
        console.warn('tuning FAILED');
        failure(Lang.PLAY_STREAM_FAILURE.format(name))
    }
    return hr;
}

function tuneNPlay(entries, name, originalUrl, _cb, type){ // entries can be a string search term
    console.log('TUNENPLAY ENTRIES', entries);
    if(!name){
        if(typeof(entries)=='string'){
            name = entries;
        } else {
            name = entries[0].name;
        }
    }
    var failure = () => {
        leavePendingState();
        notify(Lang.NONE_STREAM_WORKED.format(name), 'fa-exclamation-circle faclr-red', 'normal')
    }
    if(!Config.get('play-while-tuning') && Playback.active){
        stop(false, true)
    }    
    enterPendingState(ucNameFix(decodeURIComponent(name) || name)+' ('+Lang.X_OF_Y.format(0, entries.length)+')', Lang.TUNING, originalUrl);
    var hr = tune(entries, name, originalUrl, (err, entry, succeededIntent) => {
        leavePendingState();
        if(typeof(_cb)=='function'){
            _cb(err, entry, succeededIntent)
        }
        if(err){
            console.warn('tune() failure', entry, succeededIntent, err);
            failure()
        } else {
            console.warn('tune() success', entry, succeededIntent);
            enterPendingState((decodeURIComponent(entry.name) || entry.name), Lang.CONNECTING, originalUrl);
            if(succeededIntent) {
                Playback.commitIntent(succeededIntent)
            } else {
                playEntry(entry)
            }
        }
    }, type);
    if(hr === false){
        failure()
    } else {
        console.log('tuneNPlay() OK')
    }
    return hr !== false;
}

function autoCleanEntriesRunning(){
    for(var i=0; i<autoCleanEntriesQueue.length; i++){
        if(autoCleanEntriesQueue[i] && autoCleanEntriesQueue[i].cancelled){
            closingAutoCleanEntriesQueue.push(autoCleanEntriesQueue[i])
            autoCleanEntriesQueue[i] = null;
        }
    }
    autoCleanEntriesQueue = autoCleanEntriesQueue.filter((item) => {
        return !!item
    });
    return !!autoCleanEntriesQueue.length;
}

function autoCleanEntriesCancel(){
    var cancelled = false;
    if(autoCleanEntriesQueue.length){
        console.warn('AUTOCLEAN CANCEL', autoCleanEntriesQueue, traceback());
        closingAutoCleanEntriesQueue = closingAutoCleanEntriesQueue.concat(autoCleanEntriesQueue);
        autoCleanEntriesQueue = [];
        for(var i=0; i<closingAutoCleanEntriesQueue.length; i++){
            console.log(closingAutoCleanEntriesQueue[i]);
            if(closingAutoCleanEntriesQueue[i]){
                closingAutoCleanEntriesQueue[i].cancel()
            }
        }
        autoCleanEntriesStatus = '';
    }
    return cancelled;
}

function setFontSizeCallback(data){
    Theme.set('font-size', data.fontSize);
    loadTheming();    
    setActiveEntry({fontSize: Theme.get('font-size')})
}

function setIconSizeCallback(data){
    Theme.set('icon-size', data.iconSize);
    loadTheming();    
    setActiveEntry({iconSize: Theme.get('icon-size')})
}

function setBackgroundAnimationCallback(data){
    Theme.set('tuning-background-animation', data.animation);
    loadTheming();
    setActiveEntry({animation: data.animation})
}

function pickLogoFromEntries(entries, type){
    if(!type){
        type = 'stream';
    }
    var rgx = new RegExp('( |fa\-)');
    for(var i in entries){
        if(entries[i].logo && !entries[i].logo.match(rgx)){
            return entries[i].logo;
        }
    }
    return defaultIcons[type];
}

var switchPlayingStreamDefer = {term: '', entries: []}

function switchPlayingStream(intent, cb, doSearch){
    if(!intent){
        intent = (Playback.active || Playback.lastActive || false);
    }
    if(intent && [Playback.active, Playback.lastActive].indexOf(intent) != -1){
        var entry = typeof(intent.entry) != 'undefined' ? intent.entry : intent;
        var term = playingStreamKeyword(entry);
        if(term){
            if(doSearch === true){
                goSearch(term)
            }
            stop(false, true);
            var megaUrl = 'mega://play|' + term;
            fetchSharedListsSearchResults(entries => {
                if(switchPlayingStreamDefer.term != term){
                    switchPlayingStreamDefer.term = term;
                    switchPlayingStreamDefer.entries = []
                }
                switchPlayingStreamDefer.entries.push(entry);
                for(var i=0; i<switchPlayingStreamDefer.entries.length; i++){
                    entries = entries.filter((e) => {
                        return (!isMegaURL(e.url) && e.url != switchPlayingStreamDefer.entries[i].url)
                    })
                }
                entries = entries.concat(switchPlayingStreamDefer.entries.slice(0, switchPlayingStreamDefer.entries.length - 1));
                if(entries.length){
                    if([Playback.active, Playback.lastActive].indexOf(intent) != -1){
                        tuneNPlay(entries, term, megaUrl, cb);
                        return true;
                    }
                }
            }, 'live', term, true, true)
        }
    }
}

function playingStreamKeyword(entry){
    if(typeof(entry.entry)!='undefined'){
        entry = entry.entry;
    }
    if(entry){
        var megaUrl = entry.originalUrl;
        if(isMegaURL(megaUrl)){
            var parts = parseMegaURL(megaUrl);
            if(parts && parts.name){
                return parts.name;
            }
        }
        return searchTermFromEntry(entry);
    }
    return false;
}

function searchTermFromEntry(entry){
    var term = false;
    searchSuggestions.forEach((t) => {
        if(typeof(entry.name)=='string' && entry.name.toLowerCase().indexOf(t.search_term)!=-1){
			if(!term || term.length < t.search_term.length){
            	term = t.search_term;
            }
        }
    });
    return term;
}

function adjustMainCategoriesEntry(entry){
    if(entry.type != 'stream' || (entry.class && entry.class.indexOf('entry-no-wrap') != -1)){
        return entry;
    }    
    
    //console.warn('CONTINUE', entry.logo, showLogos);
    entry.type = 'group';
    entry.class = 'entry-meta-stream';
    entry.logo = showLogos && entry.logo != defaultIcons['group'] ? entry.logo || getAutoLogo(entry.name) : defaultIcons['stream'];
    entry.defaultLogo = defaultIcons['stream'];

    //console.warn('CONTINUE', entry.logo);
    entry.renderer = (data) => {
        console.warn("HOORAY", entry)
        const _path = assumePath(entry.name)
        console.warn("HOORAY", _path)
        fetchSharedListsSearchResults(entries => {
            console.warn("HOORAY", entries, _path, entry)
            if(!entries.length){
                sound('static', 16);
                notify(Lang.PLAY_STREAM_FAILURE.format(data.name), 'fa-exclamation-circle faclr-red', 'normal');
                Menu.asyncResult(_path, -1)
                return -1;
            }
            entries = listManJoinDuplicates(entries);
            var sbname = Lang.CHOOSE_STREAM+' ('+entries.length+')', megaUrl = 'mega://play|' + encodeURIComponent(data.name) + '?mediaType=' + (data.mediaType || 'all')
            if(typeof(data.originalUrl) != 'undefined' && isMegaURL(data.originalUrl)){
                megaUrl = data.originalUrl;
            } else if(isMegaURL(data.url)){
                megaUrl = data.url;
            }
            var isPlaying = Playback.active && Playback.active.entry.originalUrl.toLowerCase() == megaUrl.toLowerCase();
            //console.warn('isPlaying', Playback.active ? Playback.active.entry.originalUrl.toLowerCase() : '-', megaUrl.toLowerCase());
            var logo = showLogos ? entry.logo || pickLogoFromEntries(entries) : '';
            var metaEntries = [
                {type: 'stream', class: 'entry-vary-play-state entry-no-wrap', name: data.name, logo: logo, 
                    label: isPlaying ? Lang.TRY_OTHER_STREAM : Lang.AUTO_TUNING, 
                    url: megaUrl, 
                    callback: () => {
                        tuneNPlay(entries, data.name, megaUrl)
                    }
                },
                {type: 'group', label: Lang.MANUAL_TUNING, name: sbname, logo: 'fa-list', path: assumePath(sbname), entries: [], renderer: () => {
                    entries = entries.map((entry) => { 
                        entry.originalUrl = megaUrl;
                        if(!entry.logo){
                            entry.logo = logo;
                        }
                        return entry; 
                    });
                    return entries;
                }}
            ];
            if(isPlaying){
                metaEntries = applyFilters('playingMetaEntries', metaEntries);
                metaEntries.push({name: Lang.WINDOW, logo:'fa-window-maximize', type: 'group', renderer: () => { return getWindowModeEntries(true) }, entries: []})
            }
            var bookmarking = {name: data.name, type: 'stream', label: data.group || '', url: megaUrl}
            if(Bookmarks.is(bookmarking)){
                metaEntries.push({
                    type: 'option',
                    logo: 'fa-star-half',
                    name: Lang.REMOVE_FROM.format(Lang.BOOKMARKS),
                    callback: () => {
                        removeFav(bookmarking);
                        Menu.refresh()
                    }
                })
            } else {
                metaEntries.push({
                    type: 'option',
                    logo: 'fa-star',
                    name: Lang.ADD_TO.format(Lang.BOOKMARKS),
                    callback: () => {
                        addFav(bookmarking);
                        Menu.refresh()
                    }
                })
            }
            console.warn("HOORAY", _path, metaEntries)
            Menu.asyncResult(_path, metaEntries)
        }, data.mediaType || 'all', data.name, 'auto', true)
        console.warn("HOORAY", data.mediaType || 'all', data.name, 'auto', true)
        return [Menu.loadingEntry()]
    }
    return entry;
}

function getLiveEntries(){
    var category, ppath = assumePath(Lang.LIVE), cb = (entries) => {
        return applyFilters('liveMetaEntries', entries)
    }
    return fetchAndRenderEntries("http://app.megacubo.net/stats/data/categories."+getLocale(true)+".json", ppath, (category) => {
        category.renderer = (data) => {
            let catStations = [], _path = assumePath(data.name, ppath)
            async.forEach(data.entries, (entry, callback) => {
                fetchSharedListsSearchResults(es => {
                    console.warn(es)
                    if(es.length){
                        catStations.push(entry)
                    }
                    callback()
                }, 'live', entry.name, true, true)
            }, () => {
                Menu.asyncResult(_path, catStations.length ? catStations : [Menu.emptyEntry()])
            })
            return [Menu.loadingEntry()]
        }
        category.entries = category.entries.map((entry) => { 
            entry.type = 'stream'; 
            entry.mediaType = 'live'; 
            entry.logo = entry.logo || defaultIcons['stream']; 
            return adjustMainCategoriesEntry(entry) 
        })
        return category;
    }, cb)
}

addFilter('liveMetaEntries', (entries) => {
    entries.unshift({
        name: Lang.SEARCH, 
        logo: 'fa-search', 
        type: 'group', 
        renderer: () => {
            Menu.setBackTo(path);
            setupSearch(lastSearchTerm, 'live')
        }, 
        entries: []
    })
    entries.unshift({
        name: Lang.BEEN_WATCHED, 
        logo: 'fa-users', 
        class: 'entry-nosub', 
        labeler: parseLabelCount, 
        type: 'group', 
        renderer: () => { 
            return getWatchingEntries('live') 
        }, 
        entries: []
    })        
    entries.push({
        name: Lang.MORE_CATEGORIES,
        type: 'group',
        class: 'entry-nosub',
        renderer: () => {
            var path = assumePath(Lang.MORE_CATEGORIES);
            setTimeout(() => {
                var entries = sharedGroupsAsEntries('live');
                if(Menu.path == path){
                    Menu.asyncResult(path, entries)
                }
            }, 100);
            return [Menu.loadingEntry()];
        }
    })
    return entries
})

function getVideosEntries(data){
    return applyFilters('videosMetaEntries', sharedGroupsAsEntries('video'))
}

addFilter('videosMetaEntries', (entries) => {
    [
        {name: Lang.BEEN_WATCHED, logo: 'fa-users', class: 'entry-nosub', labeler: parseLabelCount, type: 'group', renderer: () => { return getWatchingEntries('video') }, entries: []},
        {name: Lang.SEARCH, logo: 'fa-search', type: 'group', renderer: () => {
            Menu.setBackTo(path);
            setupSearch(lastSearchTerm, 'video')
        }, entries: []}
    ].forEach(entry => {
        entries.unshift(entry)
    })
    return entries
})


function getRadioEntries(data){
    var path = assumePath(data.name);
    setTimeout(() => {
        var entries = sharedGroupsAsEntries('radio');
        if(Menu.path == path){
            Menu.loaded();
            entries = Menu.mergeEntries(Menu.getEntries(true, false, true), entries);
            Menu.asyncResult(path, entries)
        }
    }, 200);
    return [
        {name: Lang.BEEN_WATCHED, logo: 'fa-users', class: 'entry-nosub', labeler: parseLabelCount, type: 'group', renderer: () => { return getWatchingEntries('radio') }, entries: []},
        {name: Lang.SEARCH, logo: 'fa-search', type: 'group', renderer: () => {
            Menu.setBackTo(path);
            setupSearch(lastSearchTerm, 'radio')
        }, entries: []},
        Menu.loadingEntry()
    ];
}

addFilter('toolsEntries', entries => {
    entries.unshift({name: Lang.RADIOS, homeId: 'radios', labeler: parseLabelCount, logo:'fa-headphones-alt', class: 'entry-nosub search-index-vary', type: 'group', entries: [], renderer: getRadioEntries})
    return entries
})
  
function registerMediaType(struct, registerToHome){
    customMediaTypes[struct.type] = struct;
    if(struct.name && struct.icon){
        var option = {
            name: struct.name,
            type: 'group',
            logo: struct.icon,
            class: 'entry-nosub',
            homeId: struct.name.toLowerCase(),
            renderer: (data) => {
                var path = assumePath(data.name), entries = [];
                if(typeof(onlineUsersCount[struct.type]) != 'undefined' && onlineUsersCount[struct.type] > 0){
                    entries.push({name: Lang.BEEN_WATCHED, logo: 'fa-users', class: 'entry-nosub', labeler: parseLabelCount, type: 'group', renderer: () => { return getWatchingEntries(struct.type) }, entries: []})
                }
                entries = entries.concat([
                    {name: Lang.SEARCH, logo: 'fa-search', type: 'group', renderer: () => {
                        Menu.setBackTo(path);
                        setupSearch(lastSearchTerm, struct.type)
                    }, entries: []},
                    Menu.loadingEntry()
                ]);
                setTimeout(() => {
                    var entries = struct.categories ? sharedGroupsAsEntries(struct.type) : [];
                    if(struct.categories_cb){
                        entries = struct.categories_cb(entries, (es) => {
                            if(Menu.path == path){
                                Menu.loaded();
                                entries = Menu.mergeEntries(Menu.getEntries(true, false, true), es);
                                Menu.asyncResult(path, entries)
                            }
                        })
                    }
                }, 200);
                return entries;
            }
        }
        if(typeof(struct.search) == 'function'){
            registerSearchEngine(struct.name, struct.type, struct.search, struct.searchMode || false)
        }
        if(registerToHome){
            customMediaEntries.push(option)
        }
        return option
    }
}

addFilter('internalFilterEntries', (entries, path) => {
    if(!path){
        customMediaEntries.filter(parentalControlAllow).reverse().forEach((entry) => {
            entries = Menu.insert(entries, Lang.IPTV_LISTS, entry, true)
        })
    }
    return entries;
})

function isTestable(entry){
    if(isMegaURL(entry.url)){
        return false;
    }
    var type = getStreamBasicType(entry);
    if(type){
        if(typeof(customMediaTypes[type]) != 'undefined'){
            if(typeof(customMediaTypes[type]['testable']) != 'undefined' && !customMediaTypes[type]['testable']){
                return false;
            }
        }
    }
    return true;
}

function hasCustomMediaType(entry){
    var s = entry;
    if(typeof(s) =='string'){
        s = {name: '', url: s}
    }
    var type = getStreamBasicType(s);
    return typeof(customMediaTypes[type]) != 'undefined';
}

var timerTimer = 0, timerData = 0;
function timer(){
    if(timerData){
        clearTimeout(timerData['timer']);
        timerData = 0;
        return false;
    }
    var opts = [];
    [5, 15, 30, 45].forEach((m) => {
        opts.push({name: Lang.AFTER_X_MINUTES.format(m), value: m, label: Lang.TIMER, logo:'fa-clock', type: 'group', entries: [], renderer: timerChooseAction});
    });
    [1, 2, 3].forEach((h) => {
        opts.push({name: Lang.AFTER_X_HOURS.format(h), value: h * 60, label: Lang.TIMER, logo:'fa-clock', type: 'group', entries: [], renderer: timerChooseAction});
    });
    return opts;
}

function timerChooseAction(data){
    console.warn('TIMER', data);
    var opts = [
        {name: Lang.STOP, type: 'option', logo: 'fa-stop', value: [data.value, 1], callback: timerChosen},
        {name: Lang.CLOSE, type: 'option', logo: 'fa-times-circle', value: [data.value, 2], callback: timerChosen},
        {name: Lang.SHUTDOWN, type: 'option', logo: 'fa-power-off', value: [data.value, 3], callback: timerChosen}
    ];
    return opts;
}

var timerLabel = false;

function timerChosen(data){
    var t = time();
    timerData = {minutes: data.value[0], action: data.value[1], start: t, end: t + (data.value[0] * 60)}
    timerData['timer'] = setTimeout(() => {
        console.warn('TIMER DEST', timerData);
        switch(timerData.action){
            case 1:
                stop();
                break;
            case 2:
                stop();
                closeApp();
                break;
            case 3:
                stop();
                closeApp();
                shutdown();
                break;
        }
        timerData = 0;
        timerWatch() // reset then
    }, timerData.minutes * 60000);
    Menu.go(optionsPath, timerWatch)
}

function timerWatch(){
    if(!timerLabel){
        var t = jQuery('.entry-timer');
        timerLabel = [t, t.length ? t.find('.entry-label') : false];    
    }
    if(timerData){
        if(timerLabel[0].length){
            var d = timeFormat(timerData.end - time());
            timerLabel[1].html('<i class="fas fa-clock"></i> '+d+' &middot; '+Lang.STOP);
        }
        setTimeout(timerWatch, 1000)
    } else {
        timerLabel[1].html('<i class="fas fa-stop"></i> '+timeFormat(0));
        setTimeout(() => {
            timerLabel[1].html('')    
        }, 1000)
    }
}

function timeFormat(secs){
    var sec_num = parseInt(secs, 10); // don't forget the second param
    var hours   = Math.floor(sec_num / 3600);
    var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
    var seconds = sec_num - (hours * 3600) - (minutes * 60);
    if (hours   < 10) {hours   = "0"+hours;}
    if (minutes < 10) {minutes = "0"+minutes;}
    if (seconds < 10) {seconds = "0"+seconds;}
    return hours+':'+minutes+':'+seconds;
}

var isReloading = false;
function stop(skipPlayback, isInternal){
    showPlayers(false, false);
    if(Playback.active || Playback.isLoading()){
        Playback.unbind(Playback.active);
        console.log('STOP', traceback());
        if(skipPlayback !== true){
            Playback.fullStop();
        }
        doAction('stop')
    }
    Playback.setState('stop')
    console.warn('REMOVEPAUSED', traceback());
    setTimeout(() => {
        if(updateStreamEntriesFlags){
            updateStreamEntriesFlags() // on unload => Uncaught TypeError: c.updateStreamEntriesFlags is not a function
        }
    }, 200);
    if(!isReloading && isInternal !== true){
        setTitleData(appName(), '');
        top.leavePendingState()
    }
}

function goHomeId(id, backHere, cb){
    var path = backHere ? Menu.path : '';
    Menu.entries.forEach((data) => { 
        if(data && data.homeId == id) { 
            Menu.go('', () => { 
                Menu.trigger(data, null, () => {
                    if(!path || Menu.path.indexOf(path) != -1){
                        Menu.setBackToHome()
                    } else {
                        Menu.setBackTo(path)
                    }
                    if(typeof(cb) == 'function'){
                        cb()
                    }
                }) 
            })
        }
    })
}

function goReload(){
    if(Playback.active){
        var e = Playback.active.entry;
        isReloading = true;
        setTimeout(() => {
            isReloading = false;
        }, 1000);
        stop();
        playEntry(e)
    }
}

function goTools(tool, cb){
    var p = Lang.TOOLS;
    if(tool) p += '/' + tool
    Menu.go(p, cb)
}

function goHistory(){
    goTools(Lang.HISTORY)
}

function goBookmarks(){
    var path = Menu.path;
    goHomeId('bookmarks', true)
}

function goOptions(){
    var path = Menu.path;
    goHomeId('options', true)
}

function goChangeLang(){
    var c = (top || parent);
    if(c.langPath){
        c.Menu.go(c.langPath, c.Menu.setBackToHome)
    }
}

function goOpen(){
    goHomeId('open_file', true)
}

var History = (() => {
    var key = 'history', self = {}, limit = 48
    self.data = Store.get(key)
    if(self.data === null){
        self.data = []
    }
    self.events = {}   
    self.on = (action, callback) => { // register, commit
        action = action.split(' ');
        for(var i=0;i<action.length;i++){
            if(typeof(self.events[action[i]])=='undefined'){
                self.events[action[i]] = []
            }
            self.events[action[i]].push(callback)
        }
    }
    self.off = (action, callback) => { // register, commit
        if(self && self.events){
            if(action){
                action = action.split(' ')
            } else {
                action = Object.keys(self.events)
            }
            for(var i=0;i<action.length;i++){
                if(typeof(self.events[action[i]])!='undefined'){
                    if(callback){
                        var p = self.events[action[i]].indexOf(callback)
                        if(p != -1){
                            delete self.events[action[i]][p];
                        }
                    } else {
                        self.events[action[i]] = [];
                    }
                }
            }
        }
    }
    self.trigger = (action, ...arguments) => {
        if(typeof(self.events[action])!='undefined'){
            var _args = Array.from(arguments);
            for(var i=0; i<self.events[action].length; i++){
                self.events[action][i].apply(null, _args)
            }
        }
    }
    self.get = function (index){
        if(typeof(index)=='number'){
            if(typeof(self.data[index])!='undefined'){
                return Object.assign({}, self.data[index]);
            }
            return false;
        }
        return self.data.slice(0)
    }
    self.add = function (entry){
        console.log('HISTORY ADD', entry);
        let nentry = Object.assign({}, entry);
        nentry.class = '';
        if(typeof(nentry.originalUrl) == 'string'){
            if(nentry.originalUrl.indexOf('/') != -1 && (!isMegaURL(nentry.originalUrl) || isValidMegaURL(nentry.originalUrl))){
                nentry.url = nentry.originalUrl; // ignore the runtime changes in URL
            }
        }
        if(typeof(nentry.type)!='undefined'){
            delete nentry.type;
        }
        if(nentry.logo.indexOf('//') == -1){
            nentry.logo = defaultIcons['stream'];
        }
        for(var i in self.data){
            if(self.data[i].url == nentry.url){
                delete self.data[i];
            }
        }
        self.data = self.data.filter((item) => {
            return !!item
        });
        self.data.unshift(nentry);
        self.data = self.data.slice(0, limit);
        console.log('HISTORY ADDED', self.data);
        Store.set(key, self.data, true);
        self.trigger('change', self.data)
    }
    self.clear = () => {
        self.data = [];
        Store.set(key, self.data, true);
        self.trigger('change', self.data)
    }
    return self;
})()

var Bookmarks = (() => {
    var key = 'bookmarks', self = {data: []}
    self.prepare = (_entries) => {
        var knownBMIDs = [], entries = _entries.slice(0)
        entries.forEach((bm, i) => {
            if(typeof(bm.bookmarkId) == 'string'){
                bm.bookmarkId = parseInt(bm.bookmarkId)
            }
            if(typeof(bm.bookmarkId) != 'undefined'){
                knownBMIDs.push(bm.bookmarkId)
            }
        })
        entries.forEach((bm, i) => {
            if(typeof(bm.bookmarkId) == 'undefined'){
                var j = 1
                while(knownBMIDs.indexOf(j) != -1){
                    j++;
                }
                knownBMIDs.push(j)
                entries[i].bookmarkId = j
            }
        })
        console.warn('ZZZZZZZZZZZ', entries)
        return entries.sort((a, b) => {
            if (a.bookmarkId < b.bookmarkId){
                return -1;
            }
            if (a.bookmarkId > b.bookmarkId){
                return 1;
            }
            return 0;
        }).slice(0)
    }
    self.get = (index) => {
        if(typeof(index)=='number'){
            return self.data[index] || false;
        }
        return self.data
    }
    self.is = (entry) => {
        for(var i in self.data){
            if(self.data[i].url == entry.url || (entry.originalUrl && self.data[i].url == entry.originalUrl)){
                return true;
            }
        }
    }
    self.add = (entry) => {
        let nentry = Object.assign({}, entry);
        if(nentry.originalUrl && nentry.originalUrl != nentry.url){
            nentry.url = nentry.originalUrl;
        }
        for(var i in self.data){
            if(self.data[i].url == nentry.url){
                delete self.data[i];
            }
        }
        self.data.push(nentry);
        self.data = self.prepare(self.data.filter((item) => {
            return item !== undefined;
        }))
        Store.set(key, self.data, true)
    }
    self.remove = (entry) => {
        for(var i in self.data){
            if(self.data[i].url == entry.url){
                delete self.data[i];
            }
        }
        self.data = self.prepare(self.data.filter((item) => {
            return item !== undefined;
        }))
        Store.set(key, self.data, true)
    }
    self.clear = () => {
        self.data = []
        Store.set(key, self.data, true)
    }
    self.data = Store.get(key)
    if(self.data === null){
        self.data = []
    } else {
        self.data = self.prepare(self.data)
    }
    return self
})()

function addFav(s){
    if(!s && Menu.isVisible()){
        s = Menu.selectedData();
        if(s && s.type!='stream'){
            s = false;
        }
    }
    if(!s){
        s = currentStream()
    }
    if(s && !Bookmarks.is(s)){
        Bookmarks.add(s);
        notify(Lang.FAV_ADDED.format(s.name), 'fa-star', 'normal')
    }
}

function removeFav(s){
    if(!s && Menu.isVisible()){
        s = Menu.selectedData();
        if(s && s.type != 'stream'){
            s = false;
        }
    }
    if(!s){
        s = currentStream()
    }
    if(s && Bookmarks.is(s)){
        Bookmarks.remove(s);
        notify(Lang.FAV_REMOVED.format(s.name), 'fa-star', 'normal')
    }
}

var Controls = (() => {
    var self = {}
    self.muteLock = false;
    self.video = null;
    self.events = {}
    self.box = jQuery('#vcontrols');
    self.bindings = [
        ['timeupdate', () => {
            // console.warn("TIMEUPDATE");
            self.videoTimer.text(self.timeFormat(self.video.currentTime));
            self.seekSlider.val(self.video.currentTime / (self.video.duration / 100))
        }],
        ['volumechange', () => {
            console.warn("VOLUMECHANGE")
            var v = Math.round(self.video.volume * 100);
            if(self.video.muted && self.muteLock && self.muteLock == self.video.volume){
                self.volumeSlider.val(1);
                self.video.muted = true;
                self.muteButton.hide();
                self.unmuteButton.show()
            } else {
                if(v != self.volumeSlider.val()){
                    self.volumeSlider.val(v)
                }
                if(v <= 1) {
                    self.muteLock = self.video.volume;
                    self.video.muted = true;
                    self.muteButton.hide();
                    self.unmuteButton.show();
                } else {
                    self.muteLock = -1;
                    self.video.muted = false;
                    self.muteButton.show();
                    self.unmuteButton.hide();
                }
            }
        }]
    ]
    self.prepare = () => {
        if(!self.prepared){
            self.prepared = true;
            self.volumeButton = self.box.find('a.volume-button');
            self.muteButton = self.volumeButton.find('svg.fa-volume-up');
            self.unmuteButton = self.volumeButton.find('svg.fa-volume-off');
            self.volumeSlider = self.box.find('.volume-slider input');
            self.switchButton = self.box.find('.video-switch');
            self.seekSlider = self.box.find('.video-seek input');
            self.playPauseContainer = self.box.find('.video-play');
            self.fsButton = self.box.find('.video-fullscreen');
            self.reloadButton = self.box.find('.video-reload');
            self.scaleButton = self.box.find('.video-scale');
            self.stopButton = self.box.find('.video-stop');
            self.playButton = self.playPauseContainer.find('svg.fa-play');
            self.pauseButton = self.playPauseContainer.find('svg.fa-pause');
            self.videoTimer = self.box.find('.video-timer');
            self.volumeSlider.attr('title', Lang.VOLUME);
            self.playPauseContainer.off('click').on('click', self.togglePlayback).attr('title', Lang.PLAY + '/' + Lang.PAUSE);
            self.volumeButton.off('click').on('click', self.toggleMute).attr('title', Lang.VOLUME);
            self.reloadButton.off('click').on('click', goReload).attr('title', Lang.RELOAD);
            self.scaleButton.off('click').on('click', changeScaleMode).attr('title', Lang.ASPECT_RATIO);
            self.stopButton.off('click').on('click', stop).attr('title', Lang.STOP);
            self.fsButton.off('click').on('click', toggleFullScreen).attr('title', Lang.FULLSCREEN);
            self.switchButton.off('click').on('click', () => { switchPlayingStream(false, false, false) }).attr('title', Lang.NOT_WORKED + ' - ' + Lang.TRY_OTHER_STREAM);
            self.seekSlider.off('change input').on('change input', self.seekCallback)
            self.volumeSlider.off('change input').on('change input', self.volumeCallback)
            var as = self.box.find('a');
            as.each((i, el) => {
                if(el.title){
                    jQuery(el).label(el.title, i > (as.length / 2) ? 'up-right' : 'up-left')
                }
            })
        }
    }
    self.volumeCallback = () => {
        self.video.volume = self.volumeSlider.val() / 100;
    }
    self.seekCallback = () => {
        var v = self.seekSlider.val()
        if(self.video.duration){
            self.video.currentTime = (self.video.duration / 100) * v;
        }
    }
    self.on = (action, callback) => { // register, commit
        action = action.split(' ');
        for(var i=0;i<action.length;i++){
            if(typeof(self.events[action[i]])=='undefined'){
                self.events[action[i]] = [];
            }
            self.events[action[i]].push(callback)
        }
    }
    self.off = (action, callback) => { // register, commit
        if(self && self.events){
            if(action){
                action = action.split(' ')
            } else {
                action = Object.keys(self.events)
            }
            for(var i=0;i<action.length;i++){
                if(typeof(self.events[action[i]])!='undefined'){
                    if(callback){
                        var p = self.events[action[i]].indexOf(callback)
                        if(p != -1){
                            delete self.events[action[i]][p];
                        }
                    } else {
                        self.events[action[i]] = [];
                    }
                }
            }
        }
    }
    self.trigger = (action, ...arguments) => {
        var _args = Array.from(arguments);
        if(self && self.events && jQuery.isArray(self.events[action])){
            console.log(action, traceback());
            console.log(self.events[action]);
            console.log(self.events[action].length);
            for(var i=0; self && self.events[action] && i<self.events[action].length; i++){
                self.events[action][i].apply(null, _args)
            }
        }
    }
    self.bind = (video) => {
        if(video) {
            self.prepare();
            self.seekSlider.val(1)
            video.controlsBinded = true;
            self.video = video;
            self.jvideo = jQuery(video);
            self.volumeSlider.val(Math.round(self.video.volume * 100));
            self.bindings.forEach((binding, i) => {
                self.bindings[i][0].split(' ').forEach(type => {
                    self.jvideo.off(type, self.bindings[i][1]).on(type, self.bindings[i][1])
                })                
            })
            if(self.video.paused){
                self.jvideo.triggerHandler('pause');
            } else {
                self.jvideo.triggerHandler('playing')
            }
            self.trigger('bind')
        }
    }
    self.unbind = () => {
        if(self.jvideo){
            self.video = self.jvideo = null;
        }
    }
    self.play = () => {
        if(self.video){
            self.video.play()
        }
    }
    self.pause = () => {
        if(self.video){
            self.video.pause()
        }
    }
    self.togglePlayback = () => {
        playPause()
    }
    self.toggleMute = () => {
        if(self.video){
            if(!self.video.muted) {
                self.muteLock = self.video.volume;
                self.video.muted = true;                
            } else {
                if(self.muteLock) {
                    self.video.volume = self.muteLock;
                }
                self.muteLock = -1;
                self.video.muted = false;
            }
        }
    }
    self.timeFormat = (seconds) => {
        var m = Math.floor(seconds / 60) < 10 ? '0' + Math.floor(seconds / 60) : Math.floor(seconds / 60);
        var s = Math.floor(seconds - (m * 60)) < 10 ? '0' + Math.floor(seconds - (m * 60)) : Math.floor(seconds - (m * 60));
        return m + ':' + s;
    }
    return self;
})()

Playback.on('setRatio', (ratio) => {
    Controls.box.find('.video-scale').html(ratio)
})

/*
function muteApp(muted){    
    chrome.tabs.getCurrent((tab) => {
        chrome.tabs.update(tab.id, {muted: muted})
    })
    chrome.tabs.getCurrent((tab) => {
        chrome.tabs.getAllInWindow(null, (w) => { 
            console.warn(w[0].windowId, tab.id); 
            chrome.tabs.move(tab.id, {windowId: w[0].windowId, index: -1}, () => { // crashes the window
                chrome.tabs.update(tab.id, {muted: true})
            }) 
        })
    })    
}
*/

function parseCounter(n){
    if(Config.get('abbreviate-counters')){
        return kfmt(parseInt(parseThousands(n).replaceAll(',', '').replaceAll('.', '')), 1)
    }
    return parseThousands(n)
}

function changeProfileImage(userName, cb){
    openFileDialog((file) => {
        copyFile(file, Users.loggedFolder + path.sep + 'default_icon.png', cb)
    })
}

function renameProfile(from, to, cb){
    fs.rename(Users.folder + path.sep + from, Users.folder + path.sep + to, (err) => {
        Users.load();
        cb(err);
        if(err) {
            throw err;
        } 
    })
}

function removeProfile(name, cb){
    removeFolder(Users.folder + path.sep + name, true, cb)
}

function createNewProfile(name, avatar, cb){
    var _cb = () => {
        Users.load();
        cb()
    }
    fs.mkdir(Users.folder + path.sep + name, (err) => {
        if(avatar){
            copyFile(avatar, Users.folder + path.sep + name + path.sep + 'default_icon.png', _cb)
        } else {
            _cb()
        }
    })
}

var currentAddingProfile = {}
function getProfileEntries(){
    var entries = Users.list.map((user) => {
        let src = Users.folder + path.sep + user + path.sep + 'default_icon.png';
        return {
            name: user,
            label: (user == Users.logged) ? '<i class="fas fa-user-check"></i> ' + Lang.EDIT_PROFILE : '<i class="fas fa-sign-in-alt"></i> ' + Lang.LOAD_PROFILE,
            user: user,
            type: 'group',
            logo: fs.existsSync(src) ? src : ((user == Users.logged) ? 'fa-user' : 'fa-sign-in-alt'),
            renderer: (data) => {
                if(data.user == Users.logged){
                    var entries = [
                        {name: '', value: data.user, placeholder: data.user, type: 'input', logo: 'fa-keyboard'},
                        {name: Lang.CHANGE_PROFILE_IMAGE, type: 'option', logo: 'fa-image', callback: () => { 
                            changeProfileImage(data.user, () => { 
                                Menu.back(() => {
                                    Menu.refresh()
                                }) 
                            }) 
                        }},
                        {name: Lang.SAVE, type: 'option', logo: 'fa-save', callback: () => { 
                            renameProfile(data.user, jQuery('div.list input').val(), () => { 
                                Menu.back(() => {
                                    Menu.refresh()
                                }) 
                            })
                        }},
                        {name: Lang.EXPORT_IMPORT, logo:'fa-cogs', type: 'group', entries: [
                            {name: Lang.EXPORT_CONFIG, logo:'fa-file-export', type: 'option', callback: () => {
                                saveAs('configure.json', (file) => {
                                    if(file){
                                        exportConfig(file, jQuery.noop)
                                    }
                                })
                            }},
                            {name: Lang.IMPORT_CONFIG, logo:'fa-file-import', type: 'option', callback: () => {
                                openFileDialog((file) => {
                                    importConfig(file, restartApp)
                                }, '.json')
                            }}
                        ]},
                        {name: Lang.RESET_CONFIG, logo:'fa-trash', type: 'option', callback: resetUserConfig}
                    ];
                    if(Users.list.length > 1){
                        entries.push({
                            name: Lang.REMOVE_PROFILE,
                            type: 'option',
                            logo: 'fa-trash',
                            callback: () => {
                                removeProfile(data.user, () => {
                                    restartApp(false)
                                })
                            }
                        })
                    }
                    return entries;
                } else {
                    Users.logon(data.user)
                }
            }
        }
    });
    entries.push({name: Lang.CREATE_NEW_PROFILE, type: 'group', logo: 'fa-user-plus', renderer: () => {
        return [
            {name: '', value: '', placeholder: '', type: 'input', logo: 'fa-keyboard'},
            {name: Lang.CHANGE_PROFILE_IMAGE, type: 'option', logo: 'fa-user', callback: () => { 
                openFileDialog((file) => {
                    currentAddingProfile.avatar = file;
                })
            }},
            {name: Lang.SAVE, type: 'option', logo: 'fa-save', callback: () => { 
                createNewProfile(jQuery('div.list input').val(), currentAddingProfile.avatar, () => { Menu.back() })
            }}
        ]
    }});
    return entries;
}

var internetStateNotification, updateInternetState = () => {
    if(!internetStateNotification){
        internetStateNotification = notify(Lang.NO_INTERNET_CONNECTION, 'fa-exclamation-triangle faclr-red', 'forever', true)
        jQuery(window).on('online', updateInternetState).on('offline', updateInternetState)
    }
    if(navigator.onLine){
        internetStateNotification.hide()
    } else {
        internetStateNotification.show()
    }
}

addAction('afterAppShow', updateInternetState)

var menuFooterTooltipCorrection = false;
addFilter('filterEntries', (entries, path) => {
    if(path == ''){
        var focusMinLength = entries.length > 8 ? 4 : 3, focusMaxLength = 8, minColumnsLength = 4, maxColumnsLength = 7, sections = Config.get('initial-sections'), only = Config.get('initial-sections-only');
        var posEntries = [];
        if(only && sections.indexOf('options') == -1){
            sections.push('options')
        }
        entries = entries.filter((entry) => {
            var ret = sections.indexOf(entry.homeId || '') != -1;
            if(!ret && !only){
                posEntries.push(entry)
            }
            return ret;
        }).concat(posEntries);
        var diff, focusLength, columnsLength, totalCount = entries.filter((entry) => {
            return (!entry.class || entry.class.indexOf('entry-hide') == -1) 
        }).length;
        for(var i = focusMinLength; i < focusMaxLength; i++){
            if(focusLength){
                break;
            }
            diff = totalCount - i;
            for(var j = maxColumnsLength; j > minColumnsLength; j--){
                if(!(diff % j)){
                    focusLength = i;
                    columnsLength = j;
                    break;
                }
            }
        }
        if(focusLength){
            if(!menuFooterTooltipCorrection){
                menuFooterTooltipCorrection = true;
                jQuery(document).on( "mouseenter", ".entry-compact[data-balloon]", function() { // dont "arrowize" it
                    if(this.getAttribute('data-balloon-pos') == 'up-left'){
                        var c = this.getBoundingClientRect();
                        if(c.x >= (win.width - 200)){
                            this.setAttribute('data-balloon-pos', 'up-right')
                        }
                    }
                })
            }
            entries = entries.reverse().map((entry, i) => {
                var c = (entry.class || '');
                if(diff >= 1) {
                    if(c.indexOf('entry-hide') == -1){
                        diff--;
                    }
                    if(c.indexOf('entry-compact') == -1){
                        entry.class = c + ' entry-compact';
                    }
                } else {
                    if(c.indexOf('entry-compact') != -1){
                        entry.class = c.replaceAll(' entry-compact', '')
                    }
                }
                return entry;
            }).reverse().slice(0);
            let columnWidth = 100 / columnsLength, 
                footerHeight = (((totalCount - focusLength) / columnsLength) * 0.5) * (Theme.get('icon-size') + Theme.get('menu-entry-vertical-padding'));
            stylizer(`
                body.home .menu-footer a.entry-compact { 
                    width: ${columnWidth}%;
                }
                body.home #menu .list {
                    height: calc(100% - ${footerHeight}px);
                }
            `, 'menu-footer', window)
        }
    }
    return entries;
})

var searchPath, bookmarksPath, langPath, optionsPath, langLoaded;

var afterLanguageLoad = (cb) => {
    if(cb === true){
        langLoaded = true;
        doAction('lngload')
    } else if(langLoaded){
        cb()
    } else {
        addAction('lngload', cb)
    }
}

afterLanguageLoad(() => {
    optionsPath = Lang.OPTIONS;
    livePath = Lang.LIVE;
    videosPath = Lang.VIDEOS;
    searchPath = Lang.SEARCH;
    searchVideoPath = Lang.VIDEO_SEARCH;
    bookmarksPath = Lang.BOOKMARKS;
    langPath = optionsPath + '/' + Lang.LANGUAGE;
    tunePath = optionsPath + '/' + Lang.TUNE;
    secPath = optionsPath + '/' + Lang.SECURITY;
    getSearchSuggestions();
    updateOnlineUsersCount();
    setInterval(updateOnlineUsersCount, 600000)
});

function setupScrollStartEndSupport(sel){
    var isScrolling, scrollEnd = () => {
        isScrolling = false;
        sel.trigger("scrollend")
    }
    sel.on("scroll", () => {
        if(isScrolling){
            clearTimeout(isScrolling)
        } else {
            sel.trigger("scrollstart")
        }
        isScrolling = setTimeout(scrollEnd, 400)
    })
}

var lastTabIndex = 1, controlsTriggerTimer = 0, isScrolling = false, isWheeling = false, wheelEnd, scrollDirection;

jQuery(function (){
        
    /* scrollstart|scrollend events */
    setupScrollStartEndSupport(b);

    /* wheelstart|wheelend events */
    wheelEnd = () => {
        isWheeling = false;
        b.trigger("wheelend")
    }
    jQuery(".list").on("wheel", () => {
        if(isWheeling){
            clearTimeout(isWheeling)
        } else {
            b.trigger("wheelstart")
        }
        isWheeling = setTimeout(wheelEnd, 400)
    });

    console.log(b);

    var lst = jQuery('.list div > div');
    setupScrollStartEndSupport(lst);
    lst.on('scrollend', () => {
        var y = lst.scrollTop();
        if(y >= 400){
            b.addClass('scrolled-down')
        } else {
            b.removeClass('scrolled-down')
        }
    });
    console.log(b);

    /* ignore focus handling while scrolling, with mouse or keyboard */
    (() => {
        var unlockDelay = 0;
        var lock = () => { 
            Menu.getEntries().css("pointer-events", "none") 
        }
        var unlock = () => { 
            Menu.getEntries().css("pointer-events", "all")
        }
        var unlocker = () => { 
            clearTimeout(unlock);
            unlockDelay = setTimeout(unlock, 400)
        }
        b.on("wheelstart", lock).on("wheelend", unlocker)
    })()
});

currentVersion = false;

addAction('appReady', () => {
    jQuery('#menu-toggle').label(Lang.SHOW_HIDE_MENU, 'down-right')
    jQuery.getJSON('http://app.megacubo.net/configure.json?'+time(), (data) => {
        if(!data || !data.version) return;
        currentVersion = data.version;
        if(typeof(data.adultTerms)!='undefined'){
            if(typeof(data.adultTerms) != 'string'){
                data.adultTerms = String(data.adultTerms)
            }   
            Config.set('default-parental-control-terms', fixUTF8(data.adultTerms), 30 * (24 * 3600))
        }
        console.log('VERSION', nw.App.manifest.version, currentVersion);
        installedVersion = nw.App.manifest.version;
        if(installedVersion < currentVersion){
            availableVersion = currentVersion;
            if(confirm(Lang.NEW_VERSION_AVAILABLE)){
                nw.Shell.openExternal(appDownloadUrl())
            }
        }
    })
})

$win.one('unload', () => {
    sendStats('die')
})

afterLanguageLoad(() => {
    if(Lang.SPLASH_MESSAGE){
        jQuery('#splash-message').html('<i class="fas fa-circle-notch pulse-spin"></i> ' + Lang.SPLASH_MESSAGE)
    }
})

var requestIdReferersTable = [], minVideoContentLength = (50 * (1024 * 1024));
function menuScrollUp(){
    Menu.scrollContainer().stop().animate({scrollTop: 0}, 75, 'swing')
}

const userLocales = [getLocale(false), getLocale(true), 'en'].getUnique();
var initialTasks = [];

function getUserLocales(){
    return userLocales.slice(0)
}

function handleOpenArguments(cmd){
    console.log('OPEN', cmd);
    // minimist module was giving error: notFlags.forEach is not a function
    // do it raw for now and better another day
    if(typeof(cmd)=='string'){
        cmd = cmd.split(' ')
    }
    console.log('OPEN 2', cmd);
    for(var i=0; i<cmd.length; i++){
        var force = false;
        if(cmd[i].charAt(0)=='-'){
            continue;
        }
        cmd[i] = cmd[i].replaceAll("'", "").replaceAll('"', '');
        if(cmd[i]){
            console.log('OPEN 3', cmd[i], getExt(cmd[i]));
            if(getExt(cmd[i])=='mega'){
                openMegaFile(cmd[i]);
                break;
            } else if(force || cmd[i].match(new RegExp('(rt[ms]p[a-z]?:|mms[a-z]?:|mega:|magnet:|\.(m3u8?|mp4|flv))', 'i'))){
                cmd[i] = cmd[i].replaceAll("'", "").replaceAll('"', '');
                console.log('PLAY', cmd[i]);
                var o = getFrame('overlay');
                if(o){
                    o.processFile(cmd[i])
                }
                break;
            }
            console.log('OPEN 4', cmd[i]);
        }
    }
}

function openTVGuide() {
    var url = 'https://tvguide.com';
    if(getLocale(true) == 'pt') {
        url = 'https://meuguia.tv';
    }
    nw.Shell.openExternal(url)
}

nw.App.on('open', function (argString) {
    console.warn('OPENX', arguments)
    handleOpenArguments(argString)
})

chrome.downloads.onDeterminingFilename.addListener(function (downloadItem) {
    console.warn('Cancelling download...', downloadItem);
    chrome.downloads.cancel(downloadItem.id, () => {
        console.warn('Cancelled download', downloadItem)
    })
})

addFilter('toolsEntries', (entries) => {
    entries.push({name: Lang.TV_GUIDE, append: getActionHotkey('TVGUIDE'), logo:'fa-book-open', type: 'option', callback: () => {
        openTVGuide()
    }})
	return entries;
})

function init(){

    var completeIterator = 0;

    var updateProgress = (i) => {
        completeIterator += i;
        doAction('app-load-progress', completeIterator, initialTasks.length, completeIterator / (initialTasks.length / 100))
    }
    
    // LOAD MAIN LANGUAGE FILES
    initialTasks.push((llcb) => {
        console.log('[INIT] Lang load');
        updateProgress(0.5);
        loadLanguage(getUserLocales(), 'lang', () => {
            updateProgress(0.5);
            console.log('[INIT] Lang loaded.');
            llcb();    
            afterLanguageLoad(true)
        })
    });

    // LOAD CUSTOM FRAME
    initialTasks.push((llcb) => {
        console.log('[INIT] Custom frame');
        updateProgress(0.5);
        afterLanguageLoad(() => {
            var customFrameState = isFullScreen() ? 'fullscreen' : (isMaximized() ? 'maximized' : '');
            var nwcf = require('nw-custom-frame')
            nwcf.attach(window, {
                "size": 30, // You can specify the size in em,rem, etc...
                "frameIconSize": 21, // You can specify the size in em,rem, etc...
                "includeCSS": false, 
                "customFrameState": customFrameState,
                "locales": {
                    'en': {
                        "close": Lang.CLOSE,
                        "maximize": Lang.MAXIMIZE,
                        "restore": Lang.RESTORE,
                        "minimize": Lang.MINIMIZE
                    },
                    locale: {
                        "close": Lang.CLOSE,
                        "maximize": Lang.MAXIMIZE,
                        "restore": Lang.RESTORE,
                        "minimize": Lang.MINIMIZE
                    }
                },
            });
            updateProgress(0.5);
            console.log('[INIT] Custom frame loaded.');
            llcb()
        })
    });
    
    // ADJUST UI
    initialTasks.push((llcb) => {
        console.log('[INIT] UI adjust');
        updateProgress(0.5);
        afterLanguageLoad(() => {
            document.title = appName();
            $body.on('click', (e) => { 
                if(e.target.tagName.toLowerCase()=='body'){ // fallback for when #sandbox or #player has pointer-events: none
                    Playback.play()
                }
            });
            jQuery('#menu').removeClass('hide').addClass('show'); 
            jQuery('div#miniplayer-poster').append('<div id="miniplayer-drop-hint"><i class="fas fa-arrows-alt"></i> ' + wordWrapPhrase(Lang.DRAG_HERE, 2, "<br />")+'</div>');
            var statsAlive = () => {
                var s = sendStatsPrepareEntry(currentStream());
                sendStats('alive', s)
            }
            setInterval(statsAlive, 600000); // each 600 secs
            addAction('afterAppShow', statsAlive);
            setTimeout(() => {
                doAction('afterAppShow')
            }, 5000);
            updateProgress(0.5);
            console.log('[INIT] UI adjusted (1).');
            llcb();
            jQuery(document).triggerHandler('beforeshow')
        });
    });
    
    // ADJUST UI 2
    initialTasks.push((llcb) => {
        console.log('[INIT] UI adjust (2)');
        updateProgress(0.5);
        jQuery(document).on('beforeshow', () => { // tricky hack to solve a font drawing bug
            //console.error('one');
            var t = jQuery('.nw-cf-buttons'), is = t.find('i');
            is.each((i, el) => {
                el = jQuery(el);
                el.prop('className', el.prop('className').
                    replaceAll('nw-cf-icon-close', 'nw-cf-icon fas fa-times').
                    replaceAll('nw-cf-icon-restore', 'nw-cf-icon fas fa-window-restore').
                    replaceAll('nw-cf-icon-maximize', 'nw-cf-icon far fa-window-maximize').
                    replaceAll('nw-cf-icon-minimize', 'nw-cf-icon fas fa-window-minimize')
                )
            });
            t.find('button').each((i, el) => {
                jQuery(el).label(el.title, 'down-right')
            });
            var close = jQuery('.nw-cf-close');
            close.replaceWith(close.outerHTML()); // override closing behaviour
            jQuery('#menu-trigger').label(Lang.SHOW_HIDE_MENU, 'down-right');
            jQuery.getScript("node_modules/@fortawesome/fontawesome-free/js/all.min.js");
            jQuery('.nw-cf-close').on('click', closeApp);
            //win.on('minimize', minimizeCallback);
            jQuery('.nw-cf-btn.nw-cf-minimize').on('click', minimizeCallback);
            var cl = Config.get('locale');
            console.log('Current language:', cl, typeof(cl));
            if(!cl || cl == 'en') {
                var locale = getLocale(true);
                if(locale == 'en'){
                    jQuery.getJSON('http://app.megacubo.net/get-lang', (data) => {
                        console.log('IP language:', data, data.length);
                        if(data && data.length == 2 && data != 'en' && data != Config.get('override-locale')) {
                            // unsure of language, ask user
                            Config.set('override-locale', data);
                            setTimeout(goChangeLang, 1000)
                        } else {
                            Config.set('locale', 'en')
                        }
                    })
                }
            }
            updateProgress(0.5);
            console.log('[INIT] UI adjusted (2).');
            llcb()
        })
    });

    // LOAD ADDONS
    initialTasks.push((cb) => {
        console.log('[INIT] Addons load');
        updateProgress(0.25);
        afterLanguageLoad(() => {
            updateProgress(0.25);
            console.log('[INIT] Addons loading...');
            loadAddons(() => {
                console.log('[INIT] Addons loaded.');
                updateProgress(0.5);
                cb()
            })
        })
    });

    async.parallel(initialTasks, (err, results) => {
        console.log('[INIT] App loaded.', err);
        doAction('appLoad');
        console.log('[INIT] App loaded.', err);
        if (err) {
            throw err;
        }
        console.log('[INIT] App loaded.', err);
    })
}
