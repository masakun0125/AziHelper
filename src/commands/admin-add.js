const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const supabase = require('../lib/supabase');
const checkAdmin = require('../lib/checkAdmin');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin-add')
    .setDescription('管理者を追加する（管理者 or サーバーオーナーのみ）')
    .addStringOption(opt =>
      opt.setName('discord_id')
        .setDescription('追加するユーザーのDiscord ID')
        .setRequired(true)
    ),

  async execute(interaction) {
    const isAdmin = await checkAdmin(interaction.user.id);
    const isOwner = interaction.guild?.ownerId === interaction.user.id;

    if (!isAdmin && !isOwner) {
      return interaction.reply({
        content: '❌ このコマンドは管理者またはサーバーオーナーのみ使用できます。',
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const targetId = interaction.options.getString('discord_id');

    // 既存チェック
    const { data: existing } = await supabase
      .from('admins')
      .select('discord_id')
      .eq('discord_id', targetId)
      .single();

    if (existing) {
      return interaction.editReply(`❌ <@${targetId}> はすでに管理者として登録されています。`);
    }

    const { error } = await supabase.from('admins').insert({ discord_id: targetId });

    if (error) {
      console.error(error);
      return interaction.editReply('❌ 登録中にエラーが発生しました。');
    }

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setDescription(`✅ <@${targetId}> を管理者に追加しました。`)
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },
};
