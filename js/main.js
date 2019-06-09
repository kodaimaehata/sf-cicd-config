// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
//import jquery from 'jquery'; 
//window.$ = jquery;
const vscode = acquireVsCodeApi();

function init(initObj){
    var fPkg = initObj.filesInPkg;
    var fSrc = initObj.filesInSrc;
    var tCls = initObj.filesInBuildFile;
    initializeChosen(fSrc,fPkg,tCls);
}

function initializeChosen(fSrc,fPkg,tCls){

    fSrc.ApexClass.forEach(element => {
        $('#class-selector').append(getOptionHTMLRecord(fPkg.ApexClass,element));
    });
    $("#class-selector").chosen({width:"90%"});
    $("#class-selector").on('change',function(evt,params){
        updateState(params,'ApexClass');
    });

    fSrc.ApexPage.forEach(element => {
        $('#page-selector').append(getOptionHTMLRecord(fPkg.ApexPage,element));
    });
    $("#page-selector").chosen({width:"90%"});
    $("#page-selector").on('change',function(evt,params){
        updateState(params,'ApexPage');
    });

    fSrc.ApexComponent.forEach(element => {
       $('#component-selector').append(getOptionHTMLRecord(fPkg.ApexComponent,element));
    });
    $("#component-selector").chosen({width:"90%"});
    $("#component-selector").on('change',function(evt,params){
        updateState(params,'ApexComponent');
    });

    fSrc.ApexClass.forEach(element => {
        $('#testclass-selector').append(getOptionHTMLRecord(tCls,element));
    });
    $("#testclass-selector").chosen({width:"90%"});
    $("#testclass-selector").on('change',function(evt,params){
        updateState(params, 'TestClass');
    });


    $("#save-package-btn").click(function(){
        sendFilesToSaveObj();
    });

    vscode.setState({ 'fPkg' : fPkg ,'fSrc' : fSrc,'tCls' : tCls});

}

function updateState(params,type){

    if('selected' in params){
        var state = vscode.getState();
        (type === 'TestClass') ? state.tCls.push(params.selected): state.fPkg[type].push(params.selected);
        vscode.setState({ 'fPkg' : state.fPkg ,'fSrc' : state.fSrc, 'tCls' : state.tCls});
    }else if('deselected' in params){
        var state = vscode.getState();

        (type == 'TestClass') ? deleteDeselected(params,state.tCls) : deleteDeselected(params,state.fPkg[type]);

        vscode.setState({ 'fPkg' : state.fPkg ,'fSrc' : state.fSrc, 'tCls' : state.tCls});
    }else{
        console.log('Other event');
    }

}

function deleteDeselected(params, filesArray){
    for(var i = 0 ;i< filesArray.length ;i++){
        if(filesArray[i] == params.deselected){
            filesArray.splice(i,1);
            break;
        }
    }

//    return filesArray;
}

function getOptionHTMLRecord(fPkgArray,fileName){

    if(!fPkgArray) return '<option value="' + fileName + '">' + fileName + '</option>';

    if(fPkgArray.includes(fileName)){
        return '<option value="' + fileName + '" selected>' + fileName + '</option>';
    }else{
        return '<option value="' + fileName + '">' + fileName + '</option>';
    }
    
}


function sendFilesToSaveObj(){

    var filesToSave = {ApexClass : [] ,ApexComponent : [], ApexPage : [], TestClass : []};

    $('#class_selector_chosen').find('.search-choice').each(function(){filesToSave['ApexClass'].push($(this).find('span').text());});
    $('#page_selector_chosen').find('.search-choice').each(function(){filesToSave['ApexPage'].push($(this).find('span').text());});
    $('#component_selector_chosen').find('.search-choice').each(function(){filesToSave['ApexComponent'].push($(this).find('span').text());});
    $('#testclass_selector_chosen').find('.search-choice').each(function(){filesToSave['TestClass'].push($(this).find('span').text());});

    vscode.postMessage({
        command : 'saveXMLs',
        filesToSave : filesToSave
    });
    
}

function activateScreen(){

    var state = vscode.getState();
    initializeChosen(state.fSrc,state.fPkg,state.tCls);

}

(function () {

    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event => {
        const message = event.data; // The json data that the extension sent
        switch (message.command) {
            case 'initialize':
                init(message.inObj);
                break;
            case 'saveState':
                console.log('saveState');
                vscode.postMessage({
                    command : 'alert',
                    text : 'saveStateが呼ばれた'
                });           
                break;     
            case 'activate':
                console.log('activate');
                activateScreen();
                break;
        }
    });
}());