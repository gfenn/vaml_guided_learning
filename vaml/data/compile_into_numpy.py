import json
import os
import numpy as np
from shutil import copyfile



def _to_json(obj):
    return json.dumps(
        obj=obj,
        sort_keys=True,
        indent=2
    )


# ROOT_FOLDER = '../../data'
ROOT_FOLDER = '../../../thesis_data'
NAME = 'nodsf'
OLD_FOLDER = ROOT_FOLDER + '/' + NAME + '_old'
CONVERTED_FOLDER = ROOT_FOLDER + '/' + NAME


def convert_episode(input_folder, episode_number, output_folder):
    # Load the file
    with open('{base}/episode_{num}.json'.format(base=input_folder, num=episode_number), 'r') as fh:
        json_data = json.load(fh)

    # Save the raw metadata
    out_ep = '{base}/episode_{num}'.format(base=output_folder, num=episode_number)
    with open('{}_meta.json'.format(out_ep), 'w') as fh:
        json.dump(json_data['metadata'], fh)

    # Convert steps into numpy
    steps = json_data['steps']
    rewards = np.array([x for x in map(lambda x: x['reward'], steps)])
    np.save('{}_rewards'.format(out_ep), rewards)
    return {
        'rewards': rewards
    }


def convert_run(input_folder, run_number, output_folder):
    print("Converting run " + str(run_number))
    # Create the folder
    save_run_folder = '{base}/run_{run}'.format(base=output_folder, run=run_number)
    if not os.path.exists(save_run_folder):
        os.mkdir(save_run_folder)

    # Determine list of files
    def extract_episode_id(filename):
        try:
            return int(filename.split('_')[1].split('.')[0])
        except:
            return 0
    all_episodes = list(map(extract_episode_id, list(os.listdir(input_folder))))
    all_episodes.sort()

    # Convert all episodes
    all_data = {
        'rewards': list()
    }
    for ep_number in all_episodes:
        if ep_number <= 0:
            continue
        try:
            ep_data = convert_episode(
                input_folder=input_folder,
                episode_number=ep_number,
                output_folder=save_run_folder
            )
            for key in ep_data:
                all_data[key].append(ep_data[key])
        except Exception as ex:
            print("Failed to convert episode number {}".format(ep_number))
            pass

    # Write the run reward file
    for key in all_data:
        data_field = np.concatenate(all_data[key])
        np.save('{base}/run_{run}_{key}'.format(base=save_run_folder, run=run_number, key=key), data_field)

    # Copy over the metadata file
    copyfile(
        src='{base}/metadata.json'.format(base=input_folder),
        dst='{base}/run_{run}_metadata.json'.format(base=save_run_folder, run=run_number)
    )


def convert_all(old_folder, new_folder):
    if not os.path.exists(new_folder):
        os.mkdir(new_folder)
    for folder in os.listdir(old_folder):
        if os.path.isdir(old_folder + '/' + folder):
            run_number = int(folder.split('_')[1])
            folder_path = '{base}/{folder}'.format(base=old_folder, folder=folder)
            if os.path.isdir(folder_path):
                convert_run(folder_path, run_number, new_folder)


if __name__ == '__main__':
    convert_all(OLD_FOLDER, CONVERTED_FOLDER)
