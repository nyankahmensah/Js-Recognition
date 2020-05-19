const yargs = require('yargs');
const path = require('path');
const fs = require('fs');
const pd = require('pandas-js');
const { csv } = require('modelscript/build/modelscript.cjs.js');
const { Map } = require('immutable');
const { uniq, times, padStart, isObject, isString } = require('lodash');
const { v4: uuid4 } = require('uuid');
let { exec } = require('child_process');
const { promisify } = require('util');
exec = promisify(exec);
const glob = require('glob-all');

function formatString(str, format = '0-6') {
	let [delimiter, length] = format.split('-');
	return padStart(str, length, delimiter);
}

function iterrows(dataset) {
	let iterable = dataset.to_json();
	return times(dataset.length, function(index) {
		return [
			{
				'video-id': iterable['video-id'][index],
				'start-time': iterable['start-time'][index],
				'end-time': iterable['end-time'][index],
				'label-name': iterable['label-name'][index],
				'split': iterable['split'][index],
			},
			index
		]
	})
}

function create_video_folders(
	dataset,
	output_dir,
	tmp_dir
) {
	if(!dataset.columns.includes('label-name')) {
		let current_dir = path.join(output_dir, 'test')
		if(!fs.existsSync(current_dir)) {
			fs.mkdirSync(current_dir);
			return current_dir;
		}
	}
	if(!fs.existsSync(output_dir)) {
		fs.mkdirSync(output_dir);
	}
	if(!fs.existsSync(tmp_dir)) {
		fs.mkdirSync(tmp_dir);
	}
	let label_to_dir = {}
	let labels = uniq(
		Object.values(
			(dataset.to_json())
			['label-name']
		)
	);
	labels.forEach(
		function(label, index) {
			let current_dir = path.join(output_dir, label);
			if(!fs.existsSync(current_dir)) {
				fs.mkdirSync(current_dir);
			}
			label_to_dir[label] = current_dir;
		}
	)
	return label_to_dir;
}

function construct_video_filename(
	row,
	label_to_dir,
	trim_format
) {
	let basename = `${
		row['video-id']
	}_${
		formatString(row['start-time'], trim_format)
	}_${
		formatString(row['end-time'], trim_format)
	}.mp4`;
	let dirname;
	if(! isObject(label_to_dir)) {
		dirname = label_to_dir;
	}
	else {
		dirname = label_to_dir[row['label-name']];
	}
	let output_filename = path.join(dirname, basename);
	return output_filename;
}

async function download_clip(
	video_identifier,
	output_filename,
	start_time,
	end_time,
	tmp_dir,
	num_attempts=5,
	url_base='https://www.youtube.com/watch?v='
) {
	if(!isString(video_identifier)) throw new Error('video_identifier must be string')
	if(!isString(output_filename)) throw new Error('output_filename must be string')
	if(!video_identifier.length === 11) throw new Error('video_identifier must have length 11')

	let status = false;
	let tmp_filename = path.join(tmp_dir, `${uuid4()}.%(ext)s`);
	let command = [
		'youtube-dl',
		'--quiet',
		'--no-warnings',
		'-f mp4',
		'-o "' + tmp_filename + '"',
		(url_base + video_identifier)
	]
	command = command.join(' ');
	let attempts = 0;
	while (true) {
		try {
			console.log('try ', attempts)
			console.log(command);
			let {stdout, stderr} = await exec(command)
			if(stdout) console.log('stdout: ', stdout);
			if(stderr) console.log('stderr: ', stderr);
			console.log('done downloading')
			break;
		}
		catch (err) {
			console.log('error: ', err);
			attempts += 1;
			if(attempts === num_attempts) {
				return ({status, message: err.message});
			}
		}
	}
	tmp_filename = glob.sync([tmp_filename.split('.')[0] + '.*'])[0];
	command = [
		'ffmpeg', '-i',
		`"${tmp_filename}"`,
		'-ss', start_time.toString(),
		'-t', (end_time - start_time).toString(),
		'-c:v', 'libx264',
		'-c:a', 'copy',
		'-threads', '1',
		'-loglevel', 'panic',
		`"${output_filename}"`
	]
	command = command.join(' ')

	try {
		let {stdout, stderr} = await exec(command);
		if(stdout) console.log(stdout);
		if(stderr) console.log(stderr);
	}
	catch (err) {
		console.log(err)
		return ({status, message: err.message});
	}

	status = fs.existsSync(output_filename)
	fs.unlinkSync(tmp_filename)
	return ({status, message: 'Downloaded'})
}

async function download_clip_wrapper(
	row,
	label_to_dir,
	trim_format,
	tmp_dir
) {
	let output_filename = construct_video_filename(row, label_to_dir, trim_format);
	let clip_id = path.basename(output_filename).split('.mp4')[0]
	if(fs.existsSync(output_filename)) {
		let status = [clip_id, true, 'Exists'];
		return status;
	}
	let {status, message} = await download_clip(
		row['video-id'],
		output_filename,
		row['start-time'],
		row['end-time'],
        tmp_dir
	)
	return ({video_id: clip_id, downloaded: status, log: message});
}

async function parse_kinetics_annotations(
	input_csv,
	ignore_is_cc = false
) {
	let rawData = await csv.loadCSV(input_csv);
	let df = new pd.DataFrame(rawData);
	if(df.columns.includes('youtube_id')) {
		let columns = new Map({
			youtube_id: 'video-id',
            time_start: 'start-time',
            time_end: 'end-time',
            label: 'label-name'
		})
		df = df.rename({
			columns: columns,
			inplace: true
		})
	}
	return df;
}

async function main({
	input_csv,
	output_dir,
	trim_format,
	num_jobs,
	tmp_dir,
	drop_duplicates,
}) {
	//Reading and parsing the dataset
	let dataset = await parse_kinetics_annotations(input_csv);
	let label_to_dir = create_video_folders(dataset, output_dir, tmp_dir);
	num_jobs = 1;

	let status_list = [];
	if(num_jobs === 1) {
		for(const [row, idx] of iterrows(dataset)) {
			console.log(row)
			status_list.push(
				await download_clip_wrapper(
					row,
					label_to_dir,
					trim_format,
					tmp_dir
				)
			)
			console.log('status_list', status_list)
		}
	}
	else {
		 status_list = [];
	}

	fs.rmdirSync(tmp_dir)
	fs.writeFileSync('download_report.json', JSON.stringify(status_list))
}

const args = yargs
.describe('Helper script for downloading and trimming kinetics videos')
.usage('Usage: $0 [options]')
.example('$0 --input_csv foo.csv --output_dir ./bar/', 'download data in foo.csv to the directory ./bar')
.options({
	'input_csv': {
		type: 'string',
		desc: 'CSV file containing the following format: YouTube Identifier,Start time,End time,Class label',
		demandOption: true,
	},
	'output_dir': {
		type: 'string',
		desc: 'Output directory where videos will be saved',
		demandOption: true,
	},
	'f': {
		alias: 'trim_format',
		type: 'string',
		default: '0-6',
		desc: 'This will be the format for the filename of trimmed videos: videoid_%0xd(start_time)_%0xd(end_time).mp4',
	},
	'n': {
		alias: 'num_jobs',
		type: 'number',
		default: 24,
	},
	't': {
		alias: 'tmp_dir',
		type: 'string',
		default: '/tmp/kinetics',
	},
	'd': {
		alias: 'drop_duplicates',
		type: 'boolean',
		default: false,
	},
})
.epilog(`copyright ${new Date().getFullYear()} @nyankahmensah`)
.wrap(yargs.terminalWidth())
.argv;

main(args)