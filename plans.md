# Plans

## Tauri Plugins

### Window State (`window-state`) — ✅ Done
- [x] Добавить `tauri-plugin-window-state` в Cargo.toml
- [x] Зарегистрировать плагин в main.rs
- [x] Настроить сохранение: размер, позиция, maximized/minimized state
- [x] Настроить capabilites

### Autostart (`autostart`)
- [ ] Добавить `tauri-plugin-autostart` в Cargo.toml
- [ ] Зарегистрировать плагин в main.rs
- [ ] Добавить toggle в настройки приложения
- [ ] Сохранить предпочтение в localStorage

### Updater (`updater`)
- [ ] Добавить `tauri-plugin-updater` в Cargo.toml
- [ ] Зарегистрировать плагин в main.rs
- [ ] Настроить endpoint для обновлений (GitHub Releases или свой сервер)
- [ ] Добавить UI: проверка обновлений, прогресс, перезапуск
- [ ] Настроить `tauri.conf.json` updater секцию

### Store (`store`)
- [ ] Добавить `tauri-plugin-store` в Cargo.toml
- [ ] Зарегистрировать плагин в main.rs
- [ ] Мигрировать с localStorage: serverUrl, identity, avatar, recentRooms, appSettings, hotkeySettings
- [ ] Создать единый store файл `settings.json`

## Отложено

### Global Shortcut
> Не подходит — блокирует ввод назначенной кнопки в других приложениях.
> Альтернатива: использовать собственный обработчик через Windows API только когда окно активно,
> или реализовать push-to-talk через Web API (keydown на document).

##已完成 (Done)

### Custom Server Configuration
- [x] Убрать захардкоженные URL из config.ts
- [x] Экран настройки сервера на HomePage
- [x] Динамическое чтение конфигурации во всех компонентах
- [x] Убрать build artifacts (target/) из git индекса
