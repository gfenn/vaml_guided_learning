import json
import os
import numpy
from io import StringIO


def _to_json(obj):
    return json.dumps(
        obj=obj,
        sort_keys=True,
        indent=2
    )


ROOT_FOLDER = '../../data'
OLD_FOLDER = ROOT_FOLDER + '/converted'
CONVERTED_FOLDER = ROOT_FOLDER + '/asnumpy'


def convert_episode(input_folder, episode_number, output_folder):
    # Load the file
    with open('{base}/episode_{num}.json'.format(base=input_folder, num=episode_number), 'r') as fh:
        json_data = json.load(fh)

    # Save the raw metadata
    with open('{base}/episode_{num}.json'.format(base=output_folder, num=episode_number), 'r') as fh:
        json.dump(json_data['metadata'], fh)

    # Convert steps into pandas
    steps = json_data['steps']


def convert_run(input_folder, run_number, output_folder):
    # Create the folder
    save_run_folder = '{base}/run_{run}'.format(base=output_folder, run=run_number)
    if not os.path.exists(save_run_folder):
        os.mkdir(save_run_folder)

    # Convert all episodes
    for file in os.listdir(input_folder):


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
    run_number = 0
    for folder in os.listdir(old_folder):
        run_number += 1
        folder_path = '{base}/{folder}'.format(base=old_folder, folder=folder)
        if os.path.isdir(folder_path):
            convert_run(folder_path, run_number, new_folder)


if __name__ == '__main__':
    convert_all(OLD_FOLDER, CONVERTED_FOLDER)
