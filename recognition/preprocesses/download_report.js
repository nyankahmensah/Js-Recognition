const yargs = require('preprocesses/node_modules/yargs');
const fs = require('fs');
const { uniq, times, padStart, isObject, toString } = require('preprocesses/node_modules/lodash');

function process_download_report(report) {
	let output = [];
	report.forEach(function(rep) {
		
	})
}

function  wrapper_process_download_reports(json_files) {
	let all_outputs = [];
	json_files.forEach(function(file) {
		let report = fs.readFileSync(file)
		all_outputs.push(process_download_report(report))
	})
	return all_outputs;
}

function main({
	input_csv,
	input_json,
	output_file,
	trim_format,
	num_input
}) {
	let json_files = [];
	if(num_input <= 1) {
		json_files.concat(input_json)
	}
	else {
		times(num_input, function (index) {
			json_files.concat(input_json + padStart(toString(index), 2, '0'))
		})
	}
	let all_outputs = wrapper_process_download_reports(json_files)
}

const args = yargs
.describe('Helper script for downloading and trimming kinetics videos')
.usage('Usage: $0 [options]')
.example('$0 --input_csv foo.csv --output_dir ./bar/', 'download data in foo.csv to the directory ./bar')
.options({
	'input_csv': {
		type: 'string',
		desc: 'CSV file containing the following format: label, youtube_id, time_start, time_end, split, is_cc',
		demandOption: true,
	},
	'input_json': {
		type: 'string',
		default: 'download_report.json',
		desc: 'base name for download report json files',
		demandOption: true,
	},
	'output_file': {
		type: 'string',
		desc: 'Output csv file with statuses and reasons',
		demandOption: true,
	},
	'f': {
		alias: 'trim_format',
		type: 'string',
		default: '0-6',
		desc: 'This will be the format for the filename of trimmed videos: videoid_%0xd(start_time)_%0xd(end_time).mp4',
	},
	'n': {
		alias: 'num_input',
		type: 'number',
		default: 1,
		desc: 'number of input json files with the same base name input_json'
	},
})
.epilog(`copyright ${new Date().getFullYear()} @nyankahmensah`)
.wrap(yargs.terminalWidth())
.argv;

main(args)