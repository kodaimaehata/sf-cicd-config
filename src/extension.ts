import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import {parseString, Builder} from 'xml2js';
import { stringify } from 'querystring';

const f = fs;

const configPAth : string = '/.cicd-config';
const configFileName : string = '/setting.json';

var workspaceFolderPath : string = '';
var packageFolderPath : string = '';
const classesFolderPath : string = packageFolderPath + '/src/classes';
const componentsFolderPath : string = packageFolderPath + '/src/components';
const pagesFolderPath : string = packageFolderPath + '/src/pages';
const objectsFolderPath : string = packageFolderPath + '/src/objects';

const packageXmlPath : string = packageFolderPath + '/src/package.xml';
const buildXmlPath : string = packageFolderPath + '/build/build.xml';

const toBeUpdatedTargets : Array<String> = ['deployCode_SpecifiedTests','NoDeploy_SpecifiedTests']; 

var buildXmlJson : any;
var packageXmlJson : any;

export function activate(context: vscode.ExtensionContext) {


	context.subscriptions.push(
		vscode.commands.registerCommand('SF-CICD-Config.openConfigScreen', () => {
			ConfigPanel.createOrShow(context.extensionPath,createInputObject());
		})
	);

	if (vscode.window.registerWebviewPanelSerializer) {
		// Make sure we register a serializer in activation event
		vscode.window.registerWebviewPanelSerializer(ConfigPanel.viewType, {
			async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: any) {
				console.log(`Got state: ${state}`);
				console.log(state);
				ConfigPanel.revive(webviewPanel, context.extensionPath);
			}
		});
	}
}

function init(){
	try{
		workspaceFolderPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
		console.log(workspaceFolderPath + configPAth + configFileName);

		fs.statSync(workspaceFolderPath + configPAth + configFileName);

		var settingObj = JSON.parse(fs.readFileSync(workspaceFolderPath + configPAth + configFileName).toString());
		console.log(settingObj);

		packageFolderPath = workspaceFolderPath + settingObj["packageFolderPath"];

	}catch(error){
		if (error.code === 'ENOENT') {
			vscode.window.showInformationMessage('Create config Path : ' + workspaceFolderPath + configPAth);
			fs.mkdirSync(workspaceFolderPath + configPAth);

			var settingJsonStr  = {"packageFolderPath" : ""};
			vscode.window.showInformationMessage('Create config file : ' + workspaceFolderPath + configPAth + configFileName);
			fs.writeFileSync(workspaceFolderPath + configPAth + configFileName,JSON.stringify(settingJsonStr));
		} else {
			console.log(error);
			vscode.window.showErrorMessage('Error during creating setting.json. Error Message : ' + error);
		}
	}

}

function createInputObject(){

	init();

	if(!checkFolderPathAndPermission(packageFolderPath)) return;

	var filesInSrc : Object ={'ApexClass' : [] , 'ApexComponent' : [] , 'ApexPage' : [], 'CustomObject' : []};
	var filesInPkg : Object = {'ApexClass' : [] , 'ApexComponent' : [] , 'ApexPage' : [], 'CustomObject' : []};
	var fieldsInSrc : Object = {};
	var fieldsInPkg : Object = {};

	//classes, comopnents, pages、オブジェクトフォルダのファイルを検索
	fs.readdirSync(packageFolderPath + classesFolderPath).filter((v) => !v.endsWith('-meta.xml')).forEach(fName => {filesInSrc['ApexClass'].push(fName.replace('.cls',''));});
	fs.readdirSync(packageFolderPath + componentsFolderPath).filter((v) => !v.endsWith('-meta.xml')).forEach(fName => {filesInSrc['ApexComponent'].push(fName.replace('.component',''));});
	fs.readdirSync(packageFolderPath + pagesFolderPath).filter((v) => !v.endsWith('-meta.xml')).forEach(fName => {filesInSrc['ApexPage'].push(fName.replace('.page',''));});
	fs.readdirSync(packageFolderPath + objectsFolderPath).filter((v) => !v.endsWith('-meta.xml')).forEach(fName => {filesInSrc['CustomObject'].push(fName.replace('.object',''));});

	var xmlData = fs.readFileSync(packageFolderPath + packageXmlPath);

	parseString(xmlData, function(err,result){

		if(err){
			vscode.window.showErrorMessage('Error happened during parsing package.xml.');
			return;
		}

		packageXmlJson = result;
		// console.log(result);

		const builder = new Builder();

		var xmlStr = builder.buildObject(result);
		// console.log(xmlStr);	

		var types : Array<any> = result.Package.types;
		if(types){
			// console.log(types);
			var targetTypes : Array<any> = types.filter(t => {return t.name[0] === 'ApexClass'|| t.name[0] === 'ApexComponent' || t.name[0] === 'ApexPage' || t.name[0] === 'CustomObject'||t.name[0] === 'CustomField';});

			targetTypes.forEach( t => {
				if(t.name[0] === 'CustomField'){
					fieldsInPkg = setFieldsInPkg(t.members);
				}else{
					filesInPkg[t.name[0]] = t.members;
				}
			});	
		}

		var objectList : Array<string> = Object.keys(fieldsInPkg);

		fieldsInSrc = setFieldsInSrc(objectList);

	});
	console.log('**** Fields In Package.xml ****');
	console.log(fieldsInPkg);
	console.log('');

	console.log('**** Fields In .object file ****');
	console.log(fieldsInSrc);
	console.log('');


	var buildXMLData = fs.readFileSync(packageFolderPath + buildXmlPath);
	var filesInBuildFile : Object = {};
	parseString(buildXMLData, function(err,result){
		if(err){
			vscode.window.showErrorMessage('Error happened during parsing build.xml.');
			return;
		}

		buildXmlJson = result;
		var targetTags : Array<Object> = result.project.target;
		// console.log(targetTags);

		if(targetTags){
			var targetTagsWithTest : Array<any> = targetTags.filter(t => {return t['$'].name === 'deployCode_SpecifiedTests';});
			filesInBuildFile = targetTagsWithTest[0]['sf:deploy'][0].runTest;
		}
	});

	var inputObject : Object = {'filesInSrc' : filesInSrc, 'filesInPkg' : filesInPkg,'filesInBuildFile': filesInBuildFile, 'fieldsInSrc' : fieldsInSrc, 'fieldsInPkg' : fieldsInPkg};

	return inputObject;

}

function setFieldsInPkg(fieldList : Array<string>) : Object{

	var tmpFieldsInPkg : Object = {};

	fieldList.forEach(element => {
		var objName = element.split('.')[0];
		var fieldName = element.split('.')[1];

		if(!tmpFieldsInPkg.hasOwnProperty(objName)) {
			console.log('Array of ' + objName + 'will be created');
			tmpFieldsInPkg[objName] = new Array<string>();
		}
		tmpFieldsInPkg[objName].push(fieldName);
	});

	return tmpFieldsInPkg;
}

function setFieldsInSrc(objectList : Array<string>) : Object {

	var fieldsInSrc : Object = {};
	objectList.forEach(obj => {

		var objFileName = obj + '.object';
		var xmlData = fs.readFileSync( packageFolderPath + objectsFolderPath + '/' + objFileName);
		
		parseString(xmlData, function(err,result){

			if(err){
				vscode.window.showErrorMessage('Error happened during parsing ' + objFileName);
				return;
			}
	
			var customFieldsObj : Array<any> ;
			customFieldsObj = result.CustomObject.fields;
			customFieldsObj.forEach(field => {
				if(!fieldsInSrc.hasOwnProperty(obj)) fieldsInSrc[obj] = new Array<string>();
				fieldsInSrc[obj].push(field.fullName[0]);
			});
		});
	});
	return fieldsInSrc;
}

function checkFolderPathAndPermission(folderPath: String) : boolean{

	//check path of classes, comopnents, pages folder
	try{
		// console.log('folderPath' + folderPath);
		// console.log(folderPath + classesFolderPath);

		fs.accessSync(folderPath + classesFolderPath,fs.constants.R_OK);
		fs.accessSync(folderPath + componentsFolderPath, fs.constants.R_OK);
		fs.accessSync(folderPath + pagesFolderPath, fs.constants.R_OK);
	}catch (err){

		vscode.window.showErrorMessage('Folders in src were not found. Please check src/classes, src/components, src/pages exist.');
		return false;
	}

	//check package.xml path
	try{
		fs.accessSync(folderPath + packageXmlPath,fs.constants.W_OK);
	}catch (err){
		vscode.window.showErrorMessage('package.xml was not found or write permission is not set.');
		return false;
	}

	//check package.xml path
	try{
		fs.accessSync(folderPath + buildXmlPath,fs.constants.W_OK);
	}catch (err){
		vscode.window.showErrorMessage('build.xml was not found or write permission is not set.');
		return false;
	}

	return true;

}

function saveXMLs(filesToSaveObj, fieldsToSave){
	savePackagexml(filesToSaveObj, fieldsToSave);
	saveBuildXml(filesToSaveObj);
}

function savePackagexml(filesToSaveObj : Object,fieldsToSave : Object){
	var apexClassArray : Array<String> = filesToSaveObj['ApexClass'];
	var apexPageArray : Array<String> = filesToSaveObj['ApexPage'];
	var apexComponentArray : Array<String> = filesToSaveObj['ApexComponent']; 
	var customOgjectArray : Array<String> = filesToSaveObj['CustomObject']; 
	var customFieldArray : Array<String> = createFieldsArray(fieldsToSave).sort();


	var targetTypesArray : Array<Object> = new Array<Object>();
	var apexClassType : Object  = {};
	var apexPageType : Object  = {};
	var apexComponentType : Object  = {};
	var customObjectType : Object  = {};
	var customFieldType : Object = {};

	var storedTypesArray : Array<any> = packageXmlJson.Package.types;

	storedTypesArray.forEach(type  => {
		switch(type.name[0]){
			case 'ApexClass' : {apexClassType = type;break;}
			case 'ApexPage' : {apexPageType = type;break;}
			case 'ApexComponent' : {apexComponentType = type;break;}
			case 'CustomObject' : {customObjectType = type;break;}
			case 'CustomField' : {customFieldType = type;break;}
			default : {targetTypesArray.push(type); break;}
		}
	});

	if(apexClassArray.length > 0){
		if(Object.keys(apexClassType).length == 0) apexClassType['name'] = ['ApexClass'];

		apexClassType['members'] = apexClassArray;
		targetTypesArray.push(apexClassType);
	}

	if(apexPageArray.length > 0){
		if(Object.keys(apexPageType).length == 0) apexPageType['name'] = ['ApexPage'];

		apexPageType['members'] = apexPageArray;
		targetTypesArray.push(apexPageType);
	}	
	
	if(apexComponentArray.length > 0){
		if(Object.keys(apexComponentType).length == 0) apexComponentType['name'] = ['ApexComponent'];

		apexComponentType['members'] = apexComponentArray;
		targetTypesArray.push(apexComponentType);
	}

	if(customOgjectArray.length > 0){
		if(Object.keys(customObjectType).length == 0) customObjectType['name'] = ['CustomObject'];

		customObjectType['members'] = customOgjectArray;
		targetTypesArray.push(customObjectType);
	}	

	if(customFieldArray.length > 0){
		if(Object.keys(customFieldType).length == 0) customFieldType['name'] = ['CustomField'];

		customFieldType['members'] = customFieldArray;
		targetTypesArray.push(customFieldType);
	}

	// console.log('*** targetTypesArray ***');
	// console.log(targetTypesArray);

	packageXmlJson.Package.types = targetTypesArray;

	const builder = new Builder();

	var xmlStr = builder.buildObject(packageXmlJson);

	// console.log(xmlStr);

	fs.writeFile(packageFolderPath + packageXmlPath,xmlStr,function(err){
		(err)? vscode.window.showErrorMessage('Error happend on saving package.xml' + err.message) : vscode.window.showInformationMessage('Successfully saved package.xml');
	});

}

function saveBuildXml(filesToSaveObj){

	var targetArray : Array<any> = buildXmlJson.project.target;
	var testClassArray : Array<String> = filesToSaveObj.TestClass;

	targetArray.forEach(target => {
		if(toBeUpdatedTargets.includes(target['$'].name)){
			target['sf:deploy'][0].runTest = testClassArray.sort();
		} 
	});
	buildXmlJson.project.target = targetArray;

	const builder = new Builder();

	var xmlStr = builder.buildObject(buildXmlJson);
	// console.log('xmlStr to be Saved');
	// console.log(xmlStr);

	fs.writeFile(packageFolderPath + buildXmlPath,xmlStr,function(err){
		(err)? vscode.window.showErrorMessage('Error happend on saving package.xml' + err.message) : vscode.window.showInformationMessage('Successfully saved build.xml');
	});

}

function createFieldsArray(fieldsToSave : Object) : Array<string>{
	var fieldsArray : Array<string> = new Array<string>();

	var objectList : Array<string> = Object.keys(fieldsToSave);

	objectList.forEach(object => {
		fieldsToSave[object].forEach(field => {
			fieldsArray.push(object + '.' + field);			
		});
	});

	console.log('**** fieldsArray ****');
	console.log(fieldsArray);

	return fieldsArray;

}

/**
 * Manages cat coding webview panels
 */
class ConfigPanel {
	/**
	 * Track the currently panel. Only allow a single panel to exist at a time.
	 */
	public static currentPanel: ConfigPanel | undefined;

	public static readonly viewType = 'SF-CICD-Config';

	private readonly _viewTitle : string = 'SF CICD Config';
	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionPath: string;
	private _disposables: vscode.Disposable[] = [];

	public static createOrShow(extensionPath: string,inObj : Object) {
		// console.log(inObj);
		const column = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;

		// If we already have a panel, show it.
		if (ConfigPanel.currentPanel) {
			ConfigPanel.currentPanel._panel.reveal(column);
			return;
		}

		// Otherwise, create a new panel.
		const panel = vscode.window.createWebviewPanel(
			ConfigPanel.viewType,
			'SF-CICD-Config',
			column || vscode.ViewColumn.One,
			{
				// Enable javascript in the webview
				enableScripts: true,

				// And restrict the webview to only loading content from our extension's `media` directory.
				localResourceRoots: [vscode.Uri.file(path.join(extensionPath, 'js')),vscode.Uri.file(path.join(extensionPath, 'css'))]
			}
		);

		ConfigPanel.currentPanel = new ConfigPanel(panel, extensionPath);
		ConfigPanel.currentPanel._panel.webview.postMessage({command:'initialize',inObj:inObj});
	}

	public static revive(panel: vscode.WebviewPanel, extensionPath: string) {
		ConfigPanel.currentPanel._panel.webview.postMessage({command:'activate'});
	}

	private constructor(panel: vscode.WebviewPanel, extensionPath: string) {
		this._panel = panel;
		this._extensionPath = extensionPath;

		// Set the webview's initial html content
		this._updateHTMLForWebview();

		// Listen for when the panel is disposed
		// This happens when the user closes the panel or when the panel is closed programatically
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		// Update the content based on view changes
		this._panel.onDidChangeViewState(
			e => {
				if (this._panel.visible) {
					//this._updateHTMLForWebview();
					ConfigPanel.currentPanel._panel.webview.postMessage({command:'activate'});
				}
			},
			null,
			this._disposables
		);

		// Handle messages from the webview
		this._panel.webview.onDidReceiveMessage(
			message => {
				switch (message.command) {
					case 'alert':
						vscode.window.showErrorMessage(message.text);
						return;
					case 'saveXMLs':
						saveXMLs(message.filesToSave, message.fieldsToSave);
				}
			},
			null,
			this._disposables
		);
	}

	public dispose() {
		ConfigPanel.currentPanel = undefined;

		// Clean up our resources
		this._panel.dispose();

		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) 	x.dispose();
		}
	}

	private _updateHTMLForWebview(){
		this._panel.title = this._viewTitle;
		this._panel.webview.html = this._getHtmlForWebview();
	}

	private _getHtmlForWebview() {
		// Local path to main script run in the webview
		const scriptPathOnDisk = vscode.Uri.file(path.join(this._extensionPath, 'js', 'main.js'));
		const cssPathOnDisk = vscode.Uri.file(path.join(this._extensionPath , 'css','sfcicdconfig.css'));
		const jqueryPathOnDisk = vscode.Uri.file(path.join(this._extensionPath , 'js','jquery-3.2.1.min.js'));
		const chosenJSPathOnDisk = vscode.Uri.file(path.join(this._extensionPath , 'js','chosen.jquery.min.js'));
		const chosenCSSPathOnDisk = vscode.Uri.file(path.join(this._extensionPath , 'css','chosen.min.css'));


		// And the uri we use to load this script in the webview
		const scriptUri = scriptPathOnDisk.with({ scheme: 'vscode-resource' });
		const jqueryUri = jqueryPathOnDisk.with({ scheme: 'vscode-resource' });
		const chosenJSUri = chosenJSPathOnDisk.with({ scheme: 'vscode-resource' });
		const chosenCSSUri = chosenCSSPathOnDisk.with({ scheme: 'vscode-resource' });
		const cssUri = cssPathOnDisk.with({ scheme: 'vscode-resource' });

		// Use a nonce to whitelist which scripts can be run
		const nonce = getNonce();

		return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">

                <!--
                Use a content security policy to only allow loading images from https or from our extension directory,
                and only allow scripts that have a specific nonce.
                -->
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src vscode-resource: https:; script-src 'nonce-${nonce}'; style-src https: vscode-resource: ">

                <meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>Cat Coding</title>
            </head>
			<body>
				<h1>Files in Package.xml</h1>
				<h2>classes</h2>
				<select id="class-selector" multiple data-placeholder="Select Classes to include ..."></select>

				<h2>Pages</h2>
				<select id="page-selector" multiple data-placeholder="Select Pages to include ..."></select>

				<h2>components</h2>
				<select id="component-selector" multiple data-placeholder="Select Components to include ..."></select>

				<h2>CustomObjects</h2>
				<select id="object-selector" multiple data-placeholder="Select Objects to include ..."></select>

				<h2>CustomFields</h2>
				<table id="custom-field-table" >
					<colgroup>
						<col class="object-col">
					</colgroup>
					<colgroup>
						<col class="field-col">
					</colgroup>
				</table>
				<h5><button id="add-object-record-btn" class="add-object-button">Add Object for CustomFields</button></h5>

				<h1>Files in Build.xml</h1>
				<select id="testclass-selector" multiple data-placeholder="Select Test Class to include ..."></select>

				<h4><button id="save-package-btn">Save Package.xml and Build.xml</button></h4>

				<script nonce="${nonce}" src="${jqueryUri}"></script>
				<script nonce="${nonce}" src="${chosenJSUri}"></script>
				<link rel="stylesheet" href="${chosenCSSUri}">
				<link rel="stylesheet" href="${cssUri}">
				<script nonce="${nonce}" src="${scriptUri}"></script>

            </body>
            </html>`;
	}
}

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
