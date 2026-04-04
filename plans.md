# Plans

## Tauri Plugins

### Window State (`window-state`)
- [ ] Добавить `tauri-plugin-window-state` в Cargo.toml
- [ ] Зарегистрировать плагин в main.rs
- [ ] Настроить сохранение: размер, позиция, maximized/minimized state
- [ ] Настроить capabilites

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

### Dialog (`dialog`)
- [ ] Добавить `tauri-plugin-dialog` в Cargo.toml
- [ ] Зарегистрировать плагин в main.rs
- [ ] Использовать для: выбор аватара, отправка файлов, подтверждение действий

### Store (`store`)
- [ ] Добавить `tauri-plugin-store` в Cargo.toml
- [ ] Зарегистрировать плагин в main.rs
- [ ] Мигрировать с localStorage: serverUrl, identity, avatar, recentRooms, appSettings, hotkeySettings
- [ ] Создать единый store файл `settings.json`

### Context Menu (`context-menu` — community)
- [ ] Добавить `tauri-plugin-context-menu` в Cargo.toml
- [ ] Зарегистрировать плагин в main.rs
- [ ] Использовать для: чат (копировать/ответить/реакции), участники (мут/кик), сообщения

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
