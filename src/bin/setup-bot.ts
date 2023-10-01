#! /usr/bin/env ts-node

/**
 * Utility script to perform the bot setup, run with --help for usage
 */
import { Option, program } from 'commander';
import { bot, i18n } from '../main';

const availableLocales = [
  ...i18n.locales.map((locale) => ({
    locale,
    languageCode: locale,
    name: locale,
  })),
  {
    locale: process.env.DEFAULT_LOCALE ?? 'en',
    languageCode: undefined,
    name: 'default',
  },
];
const localesToUpdate: (typeof availableLocales)[number][] = [];

program
  .option('--name', 'Update the name of the bot')
  .option('--commands', 'Update the bot commands')
  .option('--description', 'Update the description of the bot')
  .option('--short_description', 'Update the short description of the bot')
  .option('--rights', 'Updates the requested rights in channels and groups')
  .addOption(
    new Option('--all', 'Update everything').implies({
      name: true,
      commands: true,
      description: true,
      short_description: true,
      rights: true,
    })
  )
  .addOption(
    new Option('--lang <string>', 'Update just a single language').choices(
      availableLocales.map((x) => x.name)
    )
  )
  .addHelpText('beforeAll', 'This utility script can help you setup your bot')
  .addHelpText('afterAll', furtherSetup());

program.parse();

const options: {
  name?: true;
  commands?: true;
  description?: true;
  short_description?: true;
  rights?: true;
  all?: true;
  lang?: string;
} = program.opts();

async function setMyName() {
  for (const locale of localesToUpdate) {
    await bot.api.setMyName(i18n.translate(locale.locale, 'bot-name'), {
      language_code: locale.languageCode,
    });
    console.log('Updated name for locale', locale.name);
  }
}

async function setMyCommands() {
  for (const locale of localesToUpdate) {
    await bot.api.setMyCommands(
      [
        // set list of commands here
        {
          command: 'start',
          description: i18n.translate(locale.locale, 'start-cmd-help'),
        },
      ],
      { language_code: locale.languageCode }
    );
    console.log('Updated commands for locale', locale.name);
  }
}

async function setMyDescription() {
  for (const locale of localesToUpdate) {
    await bot.api.setMyDescription(i18n.t(locale.locale, 'bot-description'), {
      language_code: locale.languageCode,
    });
    console.log('Updated description for locale', locale.name);
  }
}

async function setMyShortDescription() {
  for (const locale of localesToUpdate) {
    await bot.api.setMyShortDescription(
      i18n.t(locale.locale, 'bot-short-description'),
      { language_code: locale.languageCode }
    );
    console.log('Updated short description for locale', locale.name);
  }
}

async function setMyDefaultAdministratorRights() {
  // not used in groups/channels
  // await bot.api.setMyDefaultAdministratorRights({
  //   for_channels: false,
  //   rights: {
  //     can_change_info: false,
  //     can_delete_messages: false,
  //     can_invite_users: false,
  //     can_manage_chat: false,
  //     can_manage_video_chats: false,
  //     can_promote_members: false,
  //     can_restrict_members: false,
  //     is_anonymous: false,
  //   },
  // });

  console.log('Updated default administrator rights');
}

function furtherSetup() {
  const nextSteps = [
    'Update the bot picture',
    'Toggle inline mode on',
    'Edit the inline placeholder',
    // 'Turn inline feedback to 100%',
  ];

  return (
    "To complete the setup, if you haven't already done it:\n" +
    nextSteps.map((x) => `- ${x}`).join('\n')
  );
}

async function main() {
  if (
    !options.name &&
    !options.commands &&
    !options.description &&
    !options.short_description &&
    !options.rights
  ) {
    program.outputHelp();
    process.exit();
  }

  if (options.lang) {
    localesToUpdate.push(
      availableLocales.find((x) => x.name === options.lang)!
    );
  } else {
    localesToUpdate.push(...availableLocales);
  }

  if (options.name) {
    await setMyName();
  }
  if (options.commands) {
    await setMyCommands();
  }
  if (options.description) {
    await setMyDescription();
  }
  if (options.short_description) {
    await setMyShortDescription();
  }
  if (options.rights) {
    await setMyDefaultAdministratorRights();
  }

  console.log();
  console.log(furtherSetup());
}

void main();
