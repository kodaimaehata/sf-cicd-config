// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
//import jquery from 'jquery'; 
//window.$ = jquery;
const vscode = acquireVsCodeApi();

function init(initObj){
    var filesInPkg = initObj.filesInPkg;
    var filesInSrc = initObj.filesInSrc;
    var fieldsInPkg = initObj.fieldsInPkg;
    var fieldsInSrc = initObj.fieldsInSrc;
    var testClass = initObj.filesInBuildFile;
    initializeChosen(filesInSrc,filesInPkg,fieldsInSrc,fieldsInPkg,testClass);
}

function initializeChosen(filesInSrc,filesInPkg,fieldsInSrc,fieldsInPkg,testClass){

    filesInSrc.ApexClass.forEach(element => {
        $('#class-selector').append(getOptionHTMLRecord(filesInPkg.ApexClass,element));
    });
    $("#class-selector").chosen({width:"90%"});
    $("#class-selector").on('change',function(evt,params){
        updateState(params,'ApexClass');
    });

    filesInSrc.ApexPage.forEach(element => {
        $('#page-selector').append(getOptionHTMLRecord(filesInPkg.ApexPage,element));
    });
    $("#page-selector").chosen({width:"90%"});
    $("#page-selector").on('change',function(evt,params){
        updateState(params,'ApexPage');
    });

    filesInSrc.ApexComponent.forEach(element => {
       $('#component-selector').append(getOptionHTMLRecord(filesInPkg.ApexComponent,element));
    });
    $("#component-selector").chosen({width:"90%"});
    $("#component-selector").on('change',function(evt,params){
        updateState(params,'ApexComponent');
    });

    filesInSrc.CustomObject.forEach(element => {
        $('#object-selector').append(getOptionHTMLRecord(filesInPkg.CustomObject,element));
    })
    $("#object-selector").chosen({width:"90%"});
    $("#object-selector").on('change',function(evt,params){
        updateState(params,'CustomObject');
    });

    filesInSrc.ApexClass.forEach(element => {
        $('#testclass-selector').append(getOptionHTMLRecord(testClass,element));
    });
    $("#testclass-selector").chosen({width:"90%"});
    $("#testclass-selector").on('change',function(evt,params){
        updateState(params, 'TestClass');
    });

    constructCustomFieldArea(fieldsInSrc, fieldsInPkg);

    $("#save-package-btn").click(function(){
        sendFilesToSaveObj();
    });

    vscode.setState({ 
        'filesInPkg' : filesInPkg ,
        'filesInSrc' : filesInSrc,
        'fieldsInPkg' : fieldsInPkg, 
        'fieldsInSrc' : fieldsInSrc, 
        'testClass' : testClass
    });
}

function constructCustomFieldArea(fieldsInSrc, fieldsInPkg){
    var objectList = Object.keys(fieldsInSrc);

    objectList.forEach(object => {

        // var delButtonId = 'object-delbutton-' + object;
        var fieldSelectorId = 'field-selector-' + object;

        // var buttonColumn = '<td><button id="' + delButtonId + '">delete</button></td>';
        var objectNameColumn = '<td>' + object + '</td>';
        var fieldsColumn = '<td><select id="' + fieldSelectorId + '" multiple data-placeholder="Select CustomFields to include ..." data-target-object="' + object + '"></select></td>';

        var objectRecord = 
            '<tr id="object-record-' + object + '">'
                //  + buttonColumn
                 + objectNameColumn
                 + fieldsColumn
            +'</tr>';

        $("#custom-field-table").append(objectRecord);

        var fieldSelector = '#' + fieldSelectorId;

        fieldsInSrc[object].forEach(field => {
            $(fieldSelector).append(getOptionHTMLRecord(fieldsInPkg[object],field));
        });

        $(fieldSelector).chosen({width : "100%"});
        $(fieldSelector).on('change', function(evt,params){
            var object = $(this).data('target-object');
            console.log('*** object name ***');
            console.log(object);
            console.log('*** params.selected ***')
            console.log(params.selected);
            updateState(params,'CustomField',object);
        })
        
    });

}

function updateState(params,type,object){

    var state = vscode.getState();

    if('selected' in params){
        switch(type){
            case 'TestClass' : {state.testClass.push(params.selected);break;}
            case 'CustomField' : {state.fieldsInPkg[object].push(params.selected);break;}
            default : {state.filesInPkg[type].push(params.selected);break;}
        }

    }else if('deselected' in params){
        switch(type){
            case 'TestClass' : {deleteDeselected(params,state.testClass) ;break;}
            case 'CustomField' : {deleteDeselected(params,state.fieldsInPkg[object]);break;}
            default : {deleteDeselected(params,state.filesInPkg[type]);break;}
        }

    }else{
        console.log('Other event');
    }

    vscode.setState(state);

}

function deleteDeselected(params, targetArray){
    for(var i = 0 ;i< targetArray.length ;i++){
        if(targetArray[i] == params.deselected){
            targetArray.splice(i,1);
            break;
        }
    }
}

function getOptionHTMLRecord(filesInPkgArray,fileName){

    if(!filesInPkgArray) return '<option value="' + fileName + '">' + fileName + '</option>';

    if(filesInPkgArray.includes(fileName)){
        return '<option value="' + fileName + '" selected>' + fileName + '</option>';
    }else{
        return '<option value="' + fileName + '">' + fileName + '</option>';
    }
    
}


function sendFilesToSaveObj(){

    var state = vscode.getState();

    var filesToSave = {
        ApexClass : state.filesInPkg.ApexClass ,
        ApexComponent : state.filesInPkg.ApexComponent, 
        ApexPage : state.filesInPkg.ApexPage,
        CustomObject  : state.filesInPkg.CustomObject,
        TestClass : state.testClass
    };

    var fieldsToSave = state.fieldsInPkg;

    // $('#class_selector_chosen').find('.search-choice').each(function(){filesToSave['ApexClass'].push($(this).find('span').text());});
    // $('#page_selector_chosen').find('.search-choice').each(function(){filesToSave['ApexPage'].push($(this).find('span').text());});
    // $('#component_selector_chosen').find('.search-choice').each(function(){filesToSave['ApexComponent'].push($(this).find('span').text());});
    // $('#object_selector_chosen').find('.search-choice').each(function(){filesToSave['CustomObject'].push($(this).find('span').text());});

    // $('#testclass_selector_chosen').find('.search-choice').each(function(){filesToSave['TestClass'].push($(this).find('span').text());});

    vscode.postMessage({
        command : 'saveXMLs',
        filesToSave : filesToSave,
        fieldsToSave : fieldsToSave
    });
    
}

function activateScreen(){

    var state = vscode.getState();
    initializeChosen(state.filesInSrc,state.filesInPkg,state.fieldsInSrc,state.fieldsInPkg,state.testClass);

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