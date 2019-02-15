import json
import os
from io import StringIO


def _to_json(obj):
    return json.dumps(
        obj=obj,
        sort_keys=True,
        indent=2
    )


class EpisodeConverter:
    def __init__(self):
        self._reset()

    def _reset(self):
        self.step_list = list()
        self.metadata = {'steps': 0, 'reward': 0, 'episode': 0, 'run': 0}

    def convert(self, filename, run, episode, save_folder):
        self.load(filename, run, episode)
        self.save(save_folder)

    def load(self, filename, run, episode):
        # Reset the data
        self._reset()
        self.metadata['run'] = run
        self.metadata['episode'] = episode

        # Open the file and read all steps
        with open(filename, 'r') as fh:
            for line in fh:
                step_json = json.load(StringIO(line.strip()))
                step_keep = {
                    'step': self.metadata['steps'] + 1,
                    'reward': step_json['reward']
                }
                self.step_list.append(step_keep)
                self.metadata['steps'] += 1
                self.metadata['reward'] += step_json['reward']

    def save(self, save_folder):
        # Save data
        steps_filename = '{base}/episode_{ep}.json'.format(base=save_folder, ep=self.metadata['episode'])
        with open(steps_filename, 'w') as fh:
            json_obj = {
                'metadata': self.metadata,
                'steps': self.step_list
            }
            fh.write(_to_json(json_obj))


ROOT_FOLDER = '../data'
OLD_FOLDER = ROOT_FOLDER + '/old'
CONVERTED_FOLDER = ROOT_FOLDER + '/converted'


def convert_run(converter: EpisodeConverter, input_folder, run_number, output_folder):
    # Statistics
    metadata = {'total_steps': 0, 'total_reward': 0, 'episodes': 0}

    # Create the folder
    save_run_folder = '{base}/run_{run}'.format(base=output_folder, run=run_number)
    if not os.path.exists(save_run_folder):
        os.mkdir(save_run_folder)

    # Convert all episodes
    all_files = os.listdir(input_folder)
    all_files.sort()
    print(all_files)
    for file in all_files:
        metadata['episodes'] += 1
        converter.convert(
            filename='{folder}/{file}'.format(folder=input_folder, file=file),
            run=run_number,
            episode=metadata['episodes'],
            save_folder=save_run_folder
        )
        metadata['total_steps'] += converter.metadata['steps']
        metadata['total_reward'] += converter.metadata['reward']

    # Save the run metadata
    run_metadata_filename = '{folder}/metadata.json'.format(folder=save_run_folder)
    with open(run_metadata_filename, 'w') as fh:
        fh.write(_to_json(metadata))


def convert_all(old_folder, new_folder):
    if not os.path.exists(new_folder):
        os.mkdir(new_folder)
    converter = EpisodeConverter()
    for folder in os.listdir(old_folder):
        tokens = folder.split('_')
        run_number = int(tokens[1])
        folder_path = '{base}/{folder}'.format(base=old_folder, folder=folder)
        if os.path.isdir(folder_path):
            convert_run(converter, folder_path, run_number, new_folder)


if __name__ == '__main__':
    print("Converting data.")
    convert_all(OLD_FOLDER, CONVERTED_FOLDER)
