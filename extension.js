
const vscode = require("vscode");
const window = vscode.window;
const Range = vscode.Range;
const Position = vscode.Position;
const OverviewRulerLane = vscode.OverviewRulerLane;
const Uri = vscode.Uri;
const workspace = vscode.workspace;
const extensions = vscode.extensions;
let gitApi = null;

require('ssl-root-cas').inject();
const rp = require('request-promise');
//require('https').globalAgent.options.ca = require('ssl-root-cas/latest').create();

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
//const vscode = require('vscode');

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "nots-io" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	//let disposable = vscode.commands.registerCommand('extension.helloWorld', function () {
	//// The code you place here will be executed every time your command is executed

	//// Display a message box to the user
	//vscode.window.showInformationMessage('Hello World!');
	//});

	//context.subscriptions.push(disposable);


	async function init_git() {
		let gitExtension = extensions.getExtension('vscode.git');
		let local_git_api = null;
		if (gitExtension !== undefined) {
			if (gitExtension.isActive) {
				local_git_api = await (new Promise((resolve, reject) => resolve(gitExtension.exports.getAPI(1))));
			}
			else {
				local_git_api = (await gitExtension.activate()).getAPI(1);
			}
		}
		gitApi = local_git_api;
	}
	async function get_repository() {
		await init_git();
		if (gitApi) {
			let rootPath = workspace.rootPath;
			let repository = gitApi.repositories.filter(r => r.rootUri.fsPath == rootPath)[0];
			return repository;
		}
	}

	async function show_gutters() {

		let file_name = window.activeTextEditor.document.fileName;
		let is_untitled = window.activeTextEditor.document.isUntitled;
		let line_count = window.activeTextEditor.document.lineCount;
		let repository = await get_repository();

		if (file_name && !is_untitled && line_count && repository) {

			let commit_sha = repository.getCommit("HEAD").hash;
			let  options = {
				method: 'GET',
				uri: 'https://nots.io/api/editor',
				qs: {
					api_key: "Q",
					project_key: "W",
					file_name: file_name,
					commit_sha: commit_sha
				},
				headers:{
					'Content-Type': 'application/json'
				},
				strictSSL: false,
				//json: true
			}
			console.log("11");
			rp(options).then(r => { console.log(r);}).catch(console.log);
			console.log("22");

			let decoration = window.createTextEditorDecorationType(
				{
					gutterIconPath: Uri.parse("https://nots.io/images/api_icon.png"),
					gutterIconSize: "contain",
				}
			);
			const range = new Range(new Position(0, 0), new Position(0, 0));
			window.activeTextEditor.setDecorations(decoration, [range]);
		}
	};
	await show_gutters();

	context.subscriptions.push(window.onDidChangeActiveTextEditor(async () => {
		await show_gutters();
	}));

}
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() { }

module.exports = {
	activate,
	deactivate
}
