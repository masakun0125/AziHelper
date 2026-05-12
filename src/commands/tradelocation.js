const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const supabase = require('../lib/supabase');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tradelocation')
    .setDescription('アイテムの取引場所を表示する')
    .addStringOption(opt =>
      opt.setName('itemname')
        .setDescription('アイテム名')
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused();
    const { data: items } = await supabase
      .from('items')
      .select('name')
      .ilike('name', `%${focused}%`)
      .limit(25);

    await interaction.respond(
      (items || []).map(i => ({ name: i.name, value: i.name }))
    );
  },

  async execute(interaction) {
    await interaction.deferReply();

    const itemname = interaction.options.getString('itemname');

    const { data: locations } = await supabase
      .from('trade_locations')
      .select('*')
      .eq('item_name', itemname)
      .order('server', { ascending: true });

    if (!locations || locations.length === 0) {
      return interaction.editReply(`❌ \`${itemname}\` の取引場所は登録されていません。`);
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`🏪 ${itemname} の取引場所`)
      .setTimestamp();

    const fields = locations.map(loc => ({
      name: `[${loc.server.toUpperCase()}]`,
      value: loc.location || '（指定なし）',
      inline: false,
    }));

    embed.addFields(fields);

    return interaction.editReply({ embeds: [embed] });
  },
};
