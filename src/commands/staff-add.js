const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require('discord.js');

const supabase = require('../lib/supabase');
const checkAdmin = require('../lib/checkAdmin');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('staff-add')
    .setDescription('staffを追加')

    .addStringOption(opt =>
      opt.setName('role')
        .setDescription('権限')
        .setRequired(true)
        .addChoices(
          {
            name: 'admin',
            value: 'admin',
          },
          {
            name: 'editor',
            value: 'editor',
          }
        )
    )

    .addStringOption(opt =>
      opt.setName('discord_id')
        .setDescription('Discord ID')
        .setRequired(true)
    ),

  async execute(interaction) {
    const staff = await checkAdmin(
      interaction.user.id
    );

    const isOwner =
      interaction.guild?.ownerId ===
      interaction.user.id;

    if (
      (!staff || staff.role !== 'admin') &&
      !isOwner
    ) {
      return interaction.reply({
        content:
          '❌ adminまたはサーバーオーナー専用です。',
        ephemeral: true,
      });
    }

    await interaction.deferReply({
      ephemeral: true,
    });

    const role =
      interaction.options.getString('role');

    const discordId =
      interaction.options.getString('discord_id');

    const { data: existing } = await supabase
      .from('admins')
      .select('discord_id')
      .eq('discord_id', discordId)
      .single();

    if (existing) {
      return interaction.editReply(
        '❌ 既に登録されています。'
      );
    }

    const { error } = await supabase
      .from('admins')
      .insert({
        discord_id: discordId,
        role,
      });

    if (error) {
      console.error(error);

      return interaction.editReply(
        '❌ 登録に失敗しました。'
      );
    }

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setDescription(
        `✅ <@${discordId}> を ${role} に追加しました。`
      )
      .setTimestamp();

    return interaction.editReply({
      embeds: [embed],
    });
  },
};
