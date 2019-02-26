
const vscode = require("vscode");
const window = vscode.window;
const Range = vscode.Range;
const Position = vscode.Position;
const OverviewRulerLane = vscode.OverviewRulerLane;
const Uri = vscode.Uri;
const workspace = vscode.workspace;
const extensions = vscode.extensions;
let gitApi = null;

//require('ssl-root-cas').inject();
const rp = require('request-promise');

/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {
	let gutter_decorations = [];
	let root_config = workspace.getConfiguration("nots-io");

	let text_decoration = window.createTextEditorDecorationType({
		light: {
			backgroundColor: root_config.get("lightBgColor")
		},
		dark: {
			backgroundColor: root_config.get("darkBgColor")
		},
		isWholeLine: true
	});
	let current_editor = null;
	let show_nots = true;
	let current_response = null;

	function get_keys() {
		root_config = workspace.getConfiguration("nots-io");
		let api_key = root_config.get("apiKey");
		let project_api_key = root_config.get("projectApiKey");
		return [api_key, project_api_key];
	}

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
		if (!window.activeTextEditor) {
			return;
		}
		if(!show_nots) {
			return;
		}
		current_editor = window.activeTextEditor;

		let uri = window.activeTextEditor.document.uri;
		let file_name = workspace.asRelativePath(uri).replace(/\\/g, '/');
		let is_untitled = window.activeTextEditor.document.isUntitled;
		let line_count = window.activeTextEditor.document.lineCount;
		let repository = await get_repository();
		let [api_key, project_api_key] = get_keys();


		if (!api_key || !project_api_key) {
			await window.showErrorMessage("Nots.io extension: Please set API keys on a workspace level");
		}

		if (file_name && !is_untitled && line_count && repository && api_key && project_api_key) {

			let commit_sha = (await repository.getCommit("HEAD")).hash;
			let options = {
				method: 'GET',
				uri: 'https://nots.io/api/editor',
				qs: {
					api_key: api_key,
					project_key: project_api_key,
					file_name: file_name,
					commit_sha: commit_sha
				},
				headers: {
					'Content-Type': 'application/json'
				},
				strictSSL: false,
				simple: false,
				//json: true
			}
			//response = await rp(options);
			let response = await rp(options);
			
			if(!response) {return;}
			current_response = JSON.parse(response);

			let text_ranges = [];

			for (let r of current_response) {
				let decoration = window.createTextEditorDecorationType(
					{
						gutterIconPath: Uri.parse(r.icon_url),
						gutterIconSize: "contain",
					}
				);
				gutter_decorations.push(decoration);
				const range = new Range(new Position(r.line_number, 0), new Position(r.line_number, 0));
				window.activeTextEditor.setDecorations(decoration, [range]);
	
				text_ranges.push(new Range(new Position(r.line_number, 0), new Position(r.end_line_number, 0)));
			}
			window.activeTextEditor.setDecorations(text_decoration, text_ranges);
		}
	};

	function remove_gutters(text_editor) {
		text_editor.setDecorations(text_decoration, []);
		
		for(let gutter_decoration in gutter_decorations) {
			text_editor.setDecorations(gutter_decoration, []);
		}
		gutter_decorations = [];
	}
	await show_gutters();

	context.subscriptions.push(window.onDidChangeActiveTextEditor(async (event) => {
		if (current_editor){
			remove_gutters(current_editor);
		}
		if (window.activeTextEditor && event.document === window.activeTextEditor.document) {
			await show_gutters();
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('nots-io.toggleNots', async () => {
		if(show_nots) {
			show_nots = false;
			remove_gutters(window.activeTextEditor);
		}
		else {
			show_nots = true;
			show_gutters();
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('nots-io.openNots', async (event) => {
		let selection = current_editor.selection.active;
		if(selection && selection.line) {
			let line = selection.line;
			for(let r of current_response) {
				if(r.line_number <= line && r.end_line_number >= line) {
					vscode.env.openExternal(Uri.parse(r.url));
				}
			}
		}
	}));
}
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() { }

module.exports = {
	activate,
	deactivate
}
