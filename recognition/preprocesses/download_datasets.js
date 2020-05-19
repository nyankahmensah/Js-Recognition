const yargs = require('yargs');
let { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
exec = promisify(exec);

let sets = {
	kinetics400: {
		url: 'https://storage.googleapis.com/deepmind-media/Datasets/kinetics400.tar.gz',
		tmp_folder: '/tmp/kinetics400',
	},
	kinetics600: {
		url: 'https://storage.googleapis.com/deepmind-media/Datasets/kinetics600.tar.gz',
		tmp_folder: '/tmp/kinetics600',
	},
	kinetics700: {
		url: 'https://storage.googleapis.com/deepmind-media/Datasets/kinetics700.tar.gz',
		tmp_folder: '/tmp/kinetics700',
	},
}

async function download_data(dataset, output_dir) {
	if(!fs.existsSync(dataset.tmp_folder)) {
		fs.mkdirSync(dataset.tmp_folder);
	}
	if(!fs.existsSync(output_dir)) {
		fs.mkdirSync(output_dir);
	}
	let command = [
		'curl', '-o',
		`${dataset.tmp_folder}/data.tar.gz`, `"${dataset.url}"`,
		'&&', 'tar',
		'-C', output_dir,
		'-zxvf', `${dataset.tmp_folder}/data.tar.gz`,
		'&&', 'rm',
		'-rf', dataset.tmp_folder
	]
	command = command.join(' ');
	try {
		let {stdout, stderr} = await exec(command);
		if(stdout) console.log(stdout);
		if(stderr) console.log(stderr);
	}
	catch (err) {
		console.log(err)
		return ({status, message: err.message});
	}
}

async function main({
	dataset,
	output_dir,
}) {
	await download_data(sets[dataset], output_dir);
	console.log('done downloading dataset', dataset)
}

const args = yargs
.describe('Helper script for downloading and trimming kinetics videos')
.usage('Usage: $0 [options]')
.example('$0 --input_csv foo.csv --output_dir ./bar/', 'download data in foo.csv to the directory ./bar')
.options({
	'dataset': {
		type: 'string',
		desc: 'Dataset to be downloaded',
		choices: ['kinetics400', 'kinetics600', 'kinetics700'],
		default: 'kinetics400'
	},
	'output_dir': {
		type: 'string',
		desc: 'Output directory where dataset will be saved',
		default: '../datasets',
	},
})
.epilog(`copyright ${new Date().getFullYear()} @nyankahmensah`)
.wrap(yargs.terminalWidth())
.argv;

main(args)