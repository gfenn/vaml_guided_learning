import json
import os
import numpy as np

def load_group_metrics(root_folder, compression):
    # Iterate files
    group = []
    for file in os.listdir(root_folder):
        tokens = file.split('_')
        try:
            data = load_run_steps(root_folder, int(tokens[1]))
            group.append(compress_steps(data, compression))
        except:
            pass


def calculate_step_metrics(group, step):
    percentiles = {
        "p100": group[0][step],
        "p75": group[0][step],
        "p50": group[0][step],
        "p25": group[0][step],
        "p0": group[0][step]
    }
    percentiles.p75 = 9


def load_run_field(root_folder, run_id, field, compression):
    # Read files
    reward_data = load_all_episodes_field_numpy(root_folder, run_id, field)
    compressed = compress_array(reward_data, compression)
    return compressed.tolist()




def compress_array(steps, compression):
    # Add padding so it is even (will be removed later)
    padding = (-len(steps)) % compression
    padded = steps if padding == 0 else np.concatenate((steps, np.zeros(padding)))

    # Reshape and apply mean on first axis
    reduced = padded.reshape(
        [padded.shape[0]//compression, compression]
    ).mean(1)

    # Padding section
    if padding > 0:
        reduced[-1] = steps[-compression:-padding].mean()
    return reduced



def iterate_episodes(run_metadata):
    for episode_id in range(1, int(run_metadata['episodes']) + 1):
        yield episode_id


#################### DIRECT LOADING OF FILES ####################

def load_run_field_json(root_folder, run_id, field):
    filename = '{base}/run_{run}/run_{run}_{field}.json'.format(
        base=root_folder,
        run=run_id,
        field=field
    )
    with open(filename, 'r') as fh:
        return json.load(fh)


def load_episode_field_numpy(root_folder, run_id, episode_id, field):
    return np.load('{base}/run_{run}/episode_{ep}_{field}.npy'.format(
        base=root_folder,
        run=run_id,
        ep=episode_id,
        field=field
    ))


def load_all_episodes_field_numpy(root_folder, run_id, field):
    return np.load('{base}/run_{run}/run_{run}_{field}.npy'.format(
        base=root_folder,
        run=run_id,
        field=field
    ))


def load_episode_field_json(root_folder, run_id, episode_id, field):
    filename = '{base}/run_{run}/episode_{ep}_{field}.json'.format(
        base=root_folder,
        run=run_id,
        ep=episode_id,
        field=field
    )
    with open(filename, 'r') as fh:
        return json.load(fh)
