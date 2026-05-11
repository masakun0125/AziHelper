const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const supabase = require('../lib/supabase');
const checkAdmin = require('../lib/checkAdmin');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('item-add')
    .setDescription('アイテムを登録する（管理者のみ）')
    .addStringOption(opt =>
      opt.setName('name')
        .setDescription('アイテム名')
        .setRequired(true)
    )
    .addAttachmentOption(opt =>
      opt.setName('icon')
        .setDescription('アイテムのアイコン画像')
        .setRequired(true)
    )
    .addAttachmentOption(opt =>
      opt.setName('lore')
        .setDescription('アイテムのlore画像')
        .setRequired(true)
    ),

  async execute(interaction) {
    // 権限チェック
    const isAdmin = await checkAdmin(interaction.user.id);
    if (!isAdmin) {
      return interaction.reply({
        content: '❌ このコマンドは管理者のみ使用できます。',
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const name = interaction.options.getString('name');
    const icon = interaction.options.getAttachment('icon');
    const lore = interaction.options.getAttachment('lore');

    // 画像チェック
    if (!icon.contentType?.startsWith('image/')) {
      return interaction.editReply('❌ iconは画像ファイルを添付してください。');
    }
    if (!lore.contentType?.startsWith('image/')) {
      return interaction.editReply('❌ loreは画像ファイルを添付してください。');
    }

    // 重複チェック
    const { data: existing } = await supabase
      .from('items')
      .select('id')
      .eq('name', name)
      .single();

    if (existing) {
      return interaction.editReply(`❌ \`${name}\` はすでに登録されています。`);
    }

    // Supabaseに保存
    const { error } = await supabase.from('items').insert({
      name,
      icon_url: icon.url,
      lore_url: lore.url,
    });

    if (error) {
      console.error(error);
      return interaction.editReply('❌ 登録中にエラーが発生しました。');
    }

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setAuthor({ name, iconURL: icon.url })
      .setDescription(`✅ \`${name}\` を登録しました。`)
      .setImage(lore.url)
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },
};
